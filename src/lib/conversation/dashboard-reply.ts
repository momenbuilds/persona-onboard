import type { Reminder } from "@/lib/schema";
import { extract } from "./engine";
import { NEED_BY_ID } from "./needs";

type Context = { agent: string; userName: string; primaryGoal: string };

const WHEN_RE =
  /\b(tomorrow(?: morning| night| at \d{1,2}(?::\d{2})?\s?(?:am|pm)?)?|tonight|today|this (?:morning|afternoon|evening)|every \w+(?: at \d{1,2}(?::\d{2})?\s?(?:am|pm)?)?|(?:on |next )?(?:mon|tues|wednes|thurs|fri|satur|sun)days?|at \d{1,2}(?::\d{2})?\s?(?:am|pm)?|in \d+ (?:minutes?|hours?|days?))\b.*$/i;

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Local replies for the dashboard preview chat. Deterministic on purpose — this
 * screen previews the product; the real agent lives in iMessage.
 * "remind me to …" creates a real reminder in the dashboard state.
 */
export function dashboardReply(text: string, ctx: Context): { reply: string; reminder?: Reminder } {
  const clean = text.trim().replace(/[.!?]+$/, "");
  const lower = clean.toLowerCase();
  const goal = ctx.primaryGoal.toLowerCase();

  if (/\bremind me\b/.test(lower)) {
    const what = clean.replace(/^.*?\bremind me\s+(?:to\s+|about\s+)?/i, "");
    const whenMatch = what.match(WHEN_RE);
    const title = (whenMatch ? what.slice(0, whenMatch.index).trim() : what).slice(0, 48) || "Check in";
    const when = whenMatch ? cap(whenMatch[0].trim()).slice(0, 40) : "Tomorrow · 9am";
    if (title.length < 2) return { reply: "sure. what should i remind you about, and when?" };
    return {
      reply: `done. i'll remind you to ${title.toLowerCase()} (${when.toLowerCase()}). it's in your reminders.`,
      reminder: { title: cap(title), when },
    };
  }

  if (/^(hi|hey|hello|yo|hiya|morning|good morning)\b/.test(lower)) {
    return { reply: `hey${ctx.userName ? ` ${ctx.userName}` : ""}! what's on your plate today?` };
  }
  if (/\b(thanks|thank you|thx|ty|appreciate it)\b/.test(lower)) {
    return { reply: "anytime. i'm here." };
  }

  const needs = extract(clean).needs;
  if (needs.length) {
    return {
      reply: `on it. that's part of "${NEED_BY_ID[needs[0]].goal.toLowerCase()}". i'll draft a plan and check with you before anything goes out.`,
    };
  }
  if (text.trim().endsWith("?")) {
    return { reply: `good question. i'll dig into it and come back with one clear answer. meanwhile, ${goal} stays front and centre.` };
  }
  return { reply: `noted. i'll keep that in mind alongside ${goal}. want a reminder for it? just say "remind me to…"` };
}
