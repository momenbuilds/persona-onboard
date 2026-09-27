import "server-only";
import { z } from "zod";
import { templateInbox, type InboxContext } from "@/lib/demo/template-inbox";
import { InboxEmailSchema, type InboxEmail } from "@/lib/schema";
import { OPENROUTER_PROVIDER, UNDERSTANDING_MODEL } from "./openrouter";

/**
 * DEMO INBOX — Gmail is mocked in this take-home. Instead of reading real mail,
 * we generate a handful of believable sample emails from the user's own
 * onboarding answers, so the dashboard can show what Persona would do with an
 * inbox (summaries, drafts, "make a PDF of the deck in my email"). Nothing here
 * touches Google.
 */

export async function generateInbox(ctx: InboxContext): Promise<{ inbox: InboxEmail[]; source: "deepseek" | "fallback" }> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return { inbox: templateInbox(ctx), source: "fallback" };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "X-Title": "Persona demo inbox" },
      body: JSON.stringify({
        model: UNDERSTANDING_MODEL,
        provider: OPENROUTER_PROVIDER,
        temperature: 0.8,
        max_tokens: 1400,
        response_format: { type: "json_object" },
        reasoning: { enabled: false },
        messages: [
          {
            role: "system",
            content: `Create a realistic DEMO inbox for a product demo. Return ONLY {"emails":[...]} with exactly 5 emails, newest first, each:
{"id":"e1","from":"First Last" or a team name,"subject":string,"date":"Mon 9:12am" style within the last 5 days,"snippet":one line,"body":1-3 short sentences,"attachment":null or {"name":"file.ext","kind":"deck"|"doc"|"sheet"|"pdf","content":plain-text contents}}
Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Any dates or deadlines you mention must be on or after today, in this year or next.
Rules: grounded in this person's actual life, work and goals. Exactly one email must carry a presentation (kind "deck") about their main goal, with content as a slide-by-slide outline of 5 short slides with concrete, specific numbers, dates and owners. At most one other email may have a short doc or sheet. Mix colleagues, clients, a vendor or bill, and something personal. Use invented people only, never real public figures. No placeholders like [Name].`,
          },
          {
            role: "user",
            content: `Person: ${ctx.userName}. ${ctx.summary}\nMain goal: ${ctx.primaryGoal}\nOther goals: ${ctx.secondaryGoals.join("; ")}\n${Object.entries(ctx.notes ?? {})
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n")}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const content = ((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
    const parsed = z
      .object({ emails: z.array(InboxEmailSchema).min(3).max(10) })
      .parse(JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1)));
    // The demo always needs one presentation ("make a PDF of the deck in my email").
    // If the model left it out, put the goal deck on top.
    const emails = parsed.emails.some((e) => e.attachment?.kind === "deck")
      ? parsed.emails
      : [templateInbox(ctx)[0], ...parsed.emails].slice(0, 8);
    return { inbox: emails.map((e, i) => ({ ...e, id: `e${i + 1}` })), source: "deepseek" };
  } catch (error) {
    console.error("[inbox]", error instanceof Error ? error.message : error);
    return { inbox: templateInbox(ctx), source: "fallback" };
  }
}
