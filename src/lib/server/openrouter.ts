import "server-only";
import type { ChatMessage, Understanding } from "@/lib/schema";
import { UnderstandingSchema } from "@/lib/schema";
import { isBlockedAgentName } from "@/lib/conversation/needs";
import { pickNames } from "@/lib/conversation/fallback";

/** DeepSeek V4.1 Flash on OpenRouter. */
export const UNDERSTANDING_MODEL = "deepseek/deepseek-v4.1-flash";

/**
 * Pin routing so DeepSeek's automatic prefix cache actually hits. OpenRouter
 * otherwise spreads requests over ~27 hosts and the cache is always cold.
 * DeepSeek's own endpoint bills cached input at ~2% of the normal price; the
 * fallbacks also discount cache reads.
 */
export const OPENROUTER_PROVIDER = { order: ["deepseek", "fireworks", "deepinfra"], allow_fallbacks: true };
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export class UnderstandingError extends Error {}

export function hasOpenRouterKey() {
  return !!process.env.OPENROUTER_API_KEY?.trim();
}

const SYSTEM_PROMPT = `You read onboarding call transcripts for Persona, a personal AI assistant that lives in iMessage and gets real things done.
Return ONLY a JSON object with exactly these keys:
{
  "userName": string,            // the user's own first name as they LAST stated it (if they corrected it, use the correction). "" if never given. Never the assistant's name.
  "summary": string,             // ONE lower-case sentence in second person, max 200 chars, warm and specific. Style example: "you're building a fashion brand, trying to stay consistent with content, and want help keeping launch tasks moving."
  "primaryGoal": string,         // the main thing they want help with, 3-8 words, sentence case, e.g. "Stay consistent with content"
  "secondaryGoals": string[],    // 0-3 other goals, same style
  "suggestedAgentNames": string[],   // exactly 3 single-word names (2-8 letters) for their assistant that feel personal and fit their goals, e.g. Atlas, Nudge, Orbit, Pace, Nova. NEVER celebrities, public figures, fictional characters, brands or existing assistants (Siri, Alexa, Jarvis, Friday...).
  "suggestedReminders": [{"title": string, "when": string}]  // exactly 3, grounded in what they said. title: imperative, max 40 chars. when: max 28 chars like "Weekdays · 6pm" or "Sundays · 11am".
}
Ignore small talk, filler and off-topic remarks. Don't invent facts that aren't in the transcript.`;

function transcriptText(messages: ChatMessage[]) {
  return messages
    .map((m) => `${m.role === "persona" ? "Persona" : "User"}: ${m.text}`)
    .join("\n")
    .slice(-8000);
}

function parseJsonLoose(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new UnderstandingError("model returned no JSON object");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Coerce near-misses (name spacing, reminder count) before strict validation. */
function normalise(data: unknown, fallback: Understanding): unknown {
  if (!data || typeof data !== "object") return data;
  const d = data as Record<string, unknown>;
  const names = Array.isArray(d.suggestedAgentNames)
    ? d.suggestedAgentNames
        .filter((n): n is string => typeof n === "string")
        .map((n) => n.trim())
        .filter((n) => /^[A-Za-z][A-Za-z' -]{0,14}[A-Za-z]$/.test(n) && !isBlockedAgentName(n))
    : [];
  const reminders = Array.isArray(d.suggestedReminders) ? d.suggestedReminders.slice(0, 3) : [];
  return {
    ...d,
    userName: typeof d.userName === "string" ? d.userName.trim().split(/\s+/)[0] ?? "" : "",
    secondaryGoals: Array.isArray(d.secondaryGoals) ? d.secondaryGoals.slice(0, 3) : [],
    suggestedAgentNames: pickNames([...names, ...fallback.suggestedAgentNames]),
    suggestedReminders: reminders.length === 3 ? reminders : [...reminders, ...fallback.suggestedReminders].slice(0, 3),
  };
}

export async function understandWithDeepSeek(
  messages: ChatMessage[],
  fallback: Understanding,
  notes?: Record<string, string>,
): Promise<Understanding> {
  const noteLines = Object.entries(notes ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new UnderstandingError("OPENROUTER_API_KEY is not set");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "Persona onboarding",
    },
    body: JSON.stringify({
      model: UNDERSTANDING_MODEL,
      provider: OPENROUTER_PROVIDER,
      temperature: 0.4,
      max_tokens: 700,
      response_format: { type: "json_object" },
      reasoning: { enabled: false },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Transcript:\n${transcriptText(messages)}${
            noteLines ? `\n\nNotes the call agent recorded at the end of the call:\n${noteLines.slice(0, 3000)}` : ""
          }`,
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new UnderstandingError(`openrouter ${res.status}`);

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new UnderstandingError("empty completion");

  const parsed = UnderstandingSchema.safeParse(normalise(parseJsonLoose(content), fallback));
  if (!parsed.success) throw new UnderstandingError(`invalid JSON shape: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}
