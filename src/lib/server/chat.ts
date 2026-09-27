import "server-only";
import {
  ChartSpecSchema,
  DocSpecSchema,
  wantsChart,
  wantsDocument,
  wantsMath,
  type ChatEvent,
} from "@/lib/chat/protocol";
import { ReminderSchema, type ChatRequest } from "@/lib/schema";
import { OPENROUTER_PROVIDER, UNDERSTANDING_MODEL } from "./openrouter";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * STATIC instructions — byte-for-byte identical on every request so DeepSeek's
 * automatic prefix cache serves them at cache-hit prices. Anything that varies
 * (profile, inbox, time) comes after this.
 */
const INSTRUCTIONS = `You are a Persona: a personal AI assistant that gets real things done for one person, texting with them inside their Persona dashboard. You are warm, sharp and genuinely capable, like a brilliant chief of staff who is also a friend.

How you think:
- Use everything you know about them (profile, goals, routine, reminders, demo inbox) and be specific to their life. Never give generic advice when you can give their advice.
- Think carefully before answering anything with numbers, dates, logic or math. Get it right; show the key steps for math.
- If something is ambiguous, make the most sensible assumption, say it in a few words, and keep going. Ask at most one question, and only when you truly can't proceed.
- Dates: use their current local time (given with each message) to resolve "tomorrow", "friday", "next week".

How you write:
- Casual texts get casual replies: lowercase except names, one to three short sentences, no emoji.
- For substantive answers you may use markdown: short paragraphs, bullet lists, numbered steps, tables, **bold** for key facts, \`code\`. No headings in chat replies.
- Math: LaTeX wrapped in double dollars, $$...$$, both inline and on its own line for displayed equations. Never use a single $ for math: a single $ always means money, like $400.

Special blocks (write the fence exactly, JSON must be valid, nothing after the closing fence on the same line):
1. Chart: when they ask for a chart, graph or plot, or to visualize, compare or break down numbers:
\`\`\`chart
{"type":"bar","title":"...","subtitle":"...","unit":"h","labels":["Mon","Tue"],"series":[{"name":"meetings","values":[5,3]}],"stats":[{"label":"total","value":"8h"}]}
\`\`\`
type is one of bar, line, area, pie, donut. Up to 4 series, up to 24 labels, up to 4 stats. If numbers are estimates, say so in one line before the chart.
2. Document: ONLY when they explicitly ask you to create, make, write or export a file: a PDF, a doc, a markdown/.md file, a report, a one-pager, a brief, a memo, a deck outline. Never for normal questions. Write one short line first ("here's the one-pager."), then:
\`\`\`document
{"title":"V2 launch one-pager","format":"pdf"}
---
# V2 launch one-pager
...full, polished markdown content...
\`\`\`
format is "pdf" unless they ask for markdown/.md. Make the document genuinely complete and well structured (headings, bullets, tables where useful). Base it on real details from their inbox/profile when they reference them.
3. Reminder: when they ask to be reminded, or say yes to a reminder you offered:
\`\`\`reminder
{"title":"Prep the v2 demo","when":"Thu · 9am"}
\`\`\`
Title is a short imperative with no day/time words; when is like "Fri · 10am", "Tomorrow · 9am", "Weekdays · 9pm".

Honesty:
- This is a preview: you cannot send emails or messages, book, buy, or open their accounts. Never claim you did. Offer to draft instead; nothing goes out without their yes.
- The inbox you can see is a demo inbox generated for this preview. Treat it as their inbox, but don't invent emails that aren't in it.`;

function profileBlock(p: ChatRequest["profile"]) {
  const reminders = p.reminders.length
    ? p.reminders.map((r) => `- ${r.title} (${r.when})${r.added ? "" : " [skipped]"}`).join("\n")
    : "- none yet";
  const notes = Object.entries(p.notes ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const inbox = p.inbox?.length
    ? p.inbox
        .map(
          (m) =>
            `### ${m.subject}\nfrom: ${m.from} · ${m.date}\n${m.body}${
              m.attachment ? `\n[attachment: ${m.attachment.name} (${m.attachment.kind})]\n${m.attachment.content}` : ""
            }`,
        )
        .join("\n\n")
    : p.gmail === "connected"
      ? "(empty)"
      : "(Gmail not connected)";
  return `Your name is ${p.agentName}. You work for ${p.userName || "them"}.

About ${p.userName || "them"}:
- summary: ${p.summary}
- main goal: ${p.primaryGoal}
- other goals: ${p.secondaryGoals.join("; ") || "none"}
${notes ? `From their onboarding call:\n${notes}\n` : ""}
Reminders:
${reminders}

Demo inbox (Gmail ${p.gmail === "connected" ? "connected in demo mode" : "not connected"}):
${inbox}`;
}

/** Older turns are trimmed so a long chat can't balloon the bill. */
function history(req: ChatRequest) {
  const msgs = req.messages.slice(-20);
  return msgs.map((m, i) => {
    const last = i === msgs.length - 1;
    const text = m.text.slice(0, 4000);
    return {
      role: m.role === "persona" ? ("assistant" as const) : ("user" as const),
      // Time goes on the newest message only, so earlier turns stay cacheable.
      content: last && m.role === "user" ? `[their local time: ${req.now.label}]\n${text}` : text,
    };
  });
}

type Emit = (e: ChatEvent) => void;

/**
 * Splits the model's streamed text into chat deltas and special fenced blocks
 * (chart / document / reminder). Text that might be the start of a fence is held
 * back until the line completes, so a block never flashes up as raw JSON.
 */
class BlockParser {
  private line = "";
  private block: { kind: "chart" | "document" | "reminder"; body: string } | null = null;

  constructor(
    private emit: Emit,
    private allowDoc: boolean,
  ) {}

  push(chunk: string) {
    for (const ch of chunk) {
      this.line += ch;
      if (ch === "\n") this.flushLine(true);
    }
    // Outside a block, stream the partial line immediately unless it could be a fence.
    if (!this.block && this.line && !"```".startsWith(this.line.slice(0, 3)) ) {
      this.emit({ t: "delta", v: this.line });
      this.line = "";
    }
  }

  end() {
    if (this.line) this.flushLine(false);
    if (this.block) this.closeBlock();
  }

  private flushLine(complete: boolean) {
    const line = this.line;
    this.line = "";
    const trimmed = line.trim();
    if (!this.block) {
      const open = trimmed.match(/^```(chart|document|reminder)\s*$/);
      if (open && complete) {
        const kind = open[1] as "chart" | "document" | "reminder";
        this.block = { kind, body: "" };
        if (kind !== "reminder") this.emit({ t: "artifact-start", kind: kind === "chart" ? "chart" : "doc" });
        return;
      }
      this.emit({ t: "delta", v: line });
      return;
    }
    if (trimmed === "```") {
      this.closeBlock();
      return;
    }
    this.block.body += line;
  }

  private closeBlock() {
    const b = this.block!;
    this.block = null;
    const id = Math.random().toString(36).slice(2, 10);
    try {
      if (b.kind === "chart") {
        const chart = ChartSpecSchema.parse(JSON.parse(b.body));
        const n = chart.labels.length;
        chart.series = chart.series.map((s) => ({ ...s, values: s.values.slice(0, n) }));
        this.emit({ t: "artifact", artifact: { kind: "chart", id, chart } });
      } else if (b.kind === "reminder") {
        this.emit({ t: "reminder", reminder: ReminderSchema.parse(JSON.parse(b.body)) });
      } else {
        const sep = b.body.indexOf("\n---");
        const header = sep >= 0 ? JSON.parse(b.body.slice(0, sep)) : { title: "Document", format: "pdf" };
        const markdown = (sep >= 0 ? b.body.slice(sep + 4) : b.body).trim();
        if (!this.allowDoc) {
          // They didn't ask for a file: show the content as a normal reply instead.
          this.emit({ t: "delta", v: `\n${markdown}\n` });
          return;
        }
        const doc = DocSpecSchema.parse({ title: header.title, format: header.format === "md" ? "md" : "pdf", markdown });
        this.emit({ t: "artifact", artifact: { kind: "doc", id, doc } });
      }
    } catch {
      if (b.kind === "document") this.emit({ t: "delta", v: `\n${b.body}\n` });
    }
  }
}

/**
 * Stream one dashboard chat turn from DeepSeek V4.1 Flash (OpenRouter).
 * Resolves once the stream ends; throws before any output if the upstream call fails.
 */
export async function streamChat(req: ChatRequest, emit: Emit, signal?: AbortSignal) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");

  const last = [...req.messages].reverse().find((m) => m.role === "user")?.text ?? "";
  const doc = wantsDocument(last);
  const math = wantsMath(last);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "Persona dashboard",
    },
    body: JSON.stringify({
      model: UNDERSTANDING_MODEL,
      provider: OPENROUTER_PROVIDER,
      stream: true,
      temperature: math ? 0.2 : 0.6,
      // Budget by need: documents get room, chat stays short.
      max_tokens: doc ? 3500 : wantsChart(last) ? 1200 : 900,
      // Brief private reasoning only where it pays off (math/logic); otherwise off for speed.
      reasoning: math ? { effort: "low", exclude: true } : { enabled: false },
      usage: { include: true },
      messages: [
        { role: "system", content: INSTRUCTIONS },
        { role: "system", content: profileBlock(req.profile) },
        ...history(req),
      ],
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
  });
  if (!res.ok || !res.body) throw new Error(`openrouter ${res.status}`);

  const parser = new BlockParser(emit, doc);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let usage: Record<string, unknown> | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const text = json.choices?.[0]?.delta?.content;
        if (text) parser.push(text);
        if (json.usage) usage = json.usage;
      } catch {
        // ignore keep-alives / partial frames
      }
    }
  }
  parser.end();
  if (usage) {
    const u = usage as { prompt_tokens?: number; completion_tokens?: number; cost?: number; prompt_tokens_details?: { cached_tokens?: number } };
    console.info(
      `[chat] in=${u.prompt_tokens} cached=${u.prompt_tokens_details?.cached_tokens ?? 0} out=${u.completion_tokens} cost=$${u.cost ?? "?"}`,
    );
  }
}
