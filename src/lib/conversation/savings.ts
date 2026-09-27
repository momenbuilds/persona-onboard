import type { TimeSaving } from "@/lib/schema";
import { NEEDS, type NeedId } from "./needs";

/**
 * "Hours back each week" — an estimate from what the user said on the call.
 * The model's numbers (or these defaults) are clamped so the savings stay believable:
 * Persona takes 15–80% off a task, never all of it.
 */

/** Typical weekly hours for each kind of help: by hand, then with Persona. */
const DEFAULTS: Record<NeedId, { task: string; manual: number; withPersona: number }> = {
  content: { task: "Planning and posting content", manual: 5, withPersona: 2 },
  launch: { task: "Chasing launch tasks", manual: 6, withPersona: 3 },
  email: { task: "Email and replies", manual: 5, withPersona: 1.5 },
  calendar: { task: "Scheduling and calendar", manual: 3, withPersona: 1 },
  fitness: { task: "Planning workouts and meals", manual: 2, withPersona: 1 },
  household: { task: "Household logistics", manual: 4, withPersona: 2 },
  clients: { task: "Invoices and client follow-ups", manual: 4, withPersona: 1.5 },
  school: { task: "Keeping up with school", manual: 5, withPersona: 3 },
  travel: { task: "Planning travel", manual: 2, withPersona: 0.5 },
  money: { task: "Bills and subscriptions", manual: 2, withPersona: 0.5 },
  focus: { task: "Planning your day", manual: 4, withPersona: 2 },
  reminders: { task: "Remembering follow-ups", manual: 2, withPersona: 0.5 },
  lifeadmin: { task: "Life admin", manual: 3, withPersona: 1 },
};

const GENERIC: TimeSaving[] = [
  { task: "Email and messages", manualHours: 4, withPersonaHours: 1.5 },
  { task: "Planning your week", manualHours: 2, withPersonaHours: 0.75 },
  { task: "Remembering follow-ups", manualHours: 2, withPersonaHours: 0.5 },
];

/** Rounds to the nearest quarter hour. */
function quarter(n: number) {
  return Math.round(n * 4) / 4;
}

export function clampSavings(items: TimeSaving[]): TimeSaving[] {
  const seen = new Set<string>();
  return items
    .filter((i) => i.task.trim() && Number.isFinite(i.manualHours) && Number.isFinite(i.withPersonaHours))
    .filter((i) => {
      const k = i.task.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((i) => {
      const manual = quarter(Math.min(12, Math.max(0.5, i.manualHours)));
      const withPersona = quarter(Math.min(manual * 0.85, Math.max(manual * 0.2, i.withPersonaHours)));
      return { task: i.task.trim().slice(0, 40), manualHours: manual, withPersonaHours: withPersona };
    })
    .slice(0, 5);
}

/** Deterministic estimate from the words the user used (no model needed). */
export function fallbackSavings(text: string): TimeSaving[] {
  const hits = NEEDS.filter((n) => n.match.test(text)).slice(0, 4);
  if (!hits.length) return GENERIC;
  const items = hits.map((n) => {
    const d = DEFAULTS[n.id];
    return { task: d.task, manualHours: d.manual, withPersonaHours: d.withPersona };
  });
  // Always a few rows, so the chart reads as a comparison.
  for (const g of GENERIC) if (items.length < 3 && !items.some((i) => i.task === g.task)) items.push(g);
  return clampSavings(items);
}

export function totals(items: TimeSaving[]) {
  const manual = items.reduce((a, i) => a + i.manualHours, 0);
  const withPersona = items.reduce((a, i) => a + i.withPersonaHours, 0);
  const savedWeek = Math.max(0, Math.round((manual - withPersona) * 2) / 2);
  return { manual, withPersona, savedWeek, savedMonth: Math.round(savedWeek * 4.3) };
}

/** "6.5 hours", "1 hour", "45 min". */
export function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  const v = Number(h.toFixed(2));
  return `${v} ${v === 1 ? "hour" : "hours"}`;
}

/** Compact bar label: "4h", "1.5h", "45m". */
export function shortHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${Number(h.toFixed(2))}h`;
}
