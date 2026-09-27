import "server-only";
import { z } from "zod";
import { clampSavings, fallbackSavings } from "@/lib/conversation/savings";
import { TimeSavingSchema, type TimeSaving } from "@/lib/schema";
import { OPENROUTER_PROVIDER, UNDERSTANDING_MODEL } from "./openrouter";

/** Weekly hours back per task, estimated from what the user said on the call. Never throws. */
export async function estimateSavings(said: string, notes?: Record<string, string>): Promise<TimeSaving[]> {
  const context = [said, ...Object.entries(notes ?? {}).map(([k, v]) => `${k}: ${v}`)].join("\n").slice(0, 2000);
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return fallbackSavings(context);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "X-Title": "Persona time savings" },
      body: JSON.stringify({
        model: UNDERSTANDING_MODEL,
        provider: OPENROUTER_PROVIDER,
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" },
        reasoning: { enabled: false },
        messages: [
          {
            role: "system",
            content: `Estimate how much time a personal AI assistant (it reads email and calendar, drafts replies, sends reminders, plans and summarizes) would save this person each week.
Return ONLY {"items":[{"task":string,"manualHours":number,"withPersonaHours":number}]} with 3 to 5 items.
- task: 2-5 words, sentence case, named from their own words (e.g. "Slack and email replies", "School deadlines").
- manualHours: realistic weekly hours they spend on it today, by hand.
- withPersonaHours: weekly hours left once the assistant helps. Be conservative: it never removes a task entirely.
Only tasks they actually mentioned or clearly implied.`,
          },
          { role: "user", content: context },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const content = ((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
    // Loose on the numbers: an over-estimate (e.g. 30h of coding) is clamped, not a reason to drop the answer.
    const Item = TimeSavingSchema.extend({ manualHours: z.number().nonnegative(), withPersonaHours: z.number().nonnegative() });
    const parsed = z
      .object({ items: z.array(Item).min(1).max(8) })
      .parse(JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1)));
    const items = clampSavings(parsed.items);
    return items.length >= 2 ? items : fallbackSavings(context);
  } catch (error) {
    console.error("[savings]", error instanceof Error ? error.message : error);
    return fallbackSavings(context);
  }
}
