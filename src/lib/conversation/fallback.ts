import type { ChatMessage, Reminder, Understanding } from "@/lib/schema";
import { joinList, slotsFromTranscript, type Slots } from "./engine";
import { DEFAULT_AGENT_NAMES, GENERIC_REMINDERS, NEED_BY_ID, isBlockedAgentName } from "./needs";

/**
 * Deterministic understanding built from the dialogue engine's slots.
 * Used whenever OPENROUTER_API_KEY is missing, the model call fails,
 * or the model's JSON doesn't pass validation — so the demo never breaks.
 */
export function fallbackUnderstanding(slots: Slots): Understanding {
  const needs = slots.needs.length ? slots.needs : (["lifeadmin"] as const);
  const defs = needs.map((id) => NEED_BY_ID[id]);

  const context = slots.project ?? (slots.role ? `${/^[aeiou]/i.test(slots.role) ? "an" : "a"} ${slots.role}` : undefined);
  const helps = joinList(defs.slice(0, 2).map((d) => d.help));
  const summary = context ? `you're ${context}, and you want help ${helps}.` : `you want help ${helps}.`;

  return {
    userName: slots.name ?? "",
    summary,
    primaryGoal: defs[0].goal,
    secondaryGoals: defs.slice(1, 4).map((d) => d.goal),
    suggestedAgentNames: pickNames(defs.flatMap((d) => d.names)),
    suggestedReminders: pickReminders(defs.map((d) => d.reminders)),
  };
}

export function fallbackFromMessages(messages: ChatMessage[]): Understanding {
  return fallbackUnderstanding(slotsFromTranscript(messages.filter((m) => m.role === "user").map((m) => m.text)));
}

/** Unique, product-safe names; pads from the default pool to exactly 3. */
export function pickNames(preferred: string[]): string[] {
  const out: string[] = [];
  for (const name of [...preferred, ...DEFAULT_AGENT_NAMES]) {
    const clean = name.trim();
    if (!clean || isBlockedAgentName(clean)) continue;
    if (out.some((n) => n.toLowerCase() === clean.toLowerCase())) continue;
    out.push(clean);
    if (out.length === 3) break;
  }
  return out;
}

/** Interleave each need's reminders (first of each, then second of each), pad to 3. */
export function pickReminders(groups: Reminder[][]): Reminder[] {
  const out: Reminder[] = [];
  const depth = Math.max(0, ...groups.map((g) => g.length));
  const ordered: Reminder[] = [];
  for (let i = 0; i < depth; i++) for (const g of groups) if (g[i]) ordered.push(g[i]);
  for (const r of [...ordered, ...GENERIC_REMINDERS]) {
    if (out.some((o) => o.title.toLowerCase() === r.title.toLowerCase())) continue;
    out.push(r);
    if (out.length === 3) break;
  }
  return out;
}
