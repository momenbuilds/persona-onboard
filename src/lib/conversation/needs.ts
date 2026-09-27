import type { Reminder } from "@/lib/schema";

export type NeedId =
  | "content"
  | "launch"
  | "email"
  | "calendar"
  | "fitness"
  | "household"
  | "clients"
  | "school"
  | "travel"
  | "money"
  | "focus"
  | "reminders"
  | "lifeadmin";

export type NeedDef = {
  id: NeedId;
  match: RegExp;
  /** Gerund phrase that completes "you want help …". */
  help: string;
  /** Title-case goal, used as primaryGoal / secondaryGoals. */
  goal: string;
  reminders: Reminder[];
  /** Agent names that suit this need, most fitting first. */
  names: string[];
};

/** Ordered by how specific the match is — earlier wins when ranking. */
export const NEEDS: NeedDef[] = [
  {
    id: "content",
    match:
      /\b(content|posts?|posting|instagram|insta|tiktok|reels?|youtube|videos?|newsletter|social media|socials|creator|blog(?:ging)?)\b/i,
    help: "staying consistent with content",
    goal: "Stay consistent with content",
    reminders: [
      { title: "Post today's content", when: "Weekdays · 6pm" },
      { title: "Batch next week's posts", when: "Sundays · 11am" },
    ],
    names: ["Nova", "Echo"],
  },
  {
    id: "launch",
    match:
      /\b(launch(?:ing|es)?|brand|product drop|store|shopify|collection|start-?up|business|side hustle|manufacturer|suppliers?)\b/i,
    help: "keeping launch tasks moving",
    goal: "Keep launch tasks moving",
    reminders: [
      { title: "Launch checklist check-in", when: "Mondays · 9am" },
      { title: "Chase supplier updates", when: "Wednesdays · 2pm" },
    ],
    names: ["Orbit", "Atlas"],
  },
  {
    id: "email",
    match: /\b(e-?mails?|inbox|gmail|replies|replying|unread)\b/i,
    help: "getting on top of your inbox",
    goal: "Get on top of the inbox",
    reminders: [
      { title: "Inbox sweep", when: "Daily · 4pm" },
      { title: "Reply to anything 2+ days old", when: "Fridays · 10am" },
    ],
    names: ["Atlas", "Wren"],
  },
  {
    id: "calendar",
    match: /\b(calendar|meetings?|schedul\w*|appointments?|agenda|back-to-back)\b/i,
    help: "wrangling your calendar",
    goal: "Keep the calendar under control",
    reminders: [
      { title: "Preview tomorrow's schedule", when: "Daily · 8pm" },
      { title: "Protect a focus block", when: "Mondays · 8am" },
    ],
    names: ["Pace", "Atlas"],
  },
  {
    id: "fitness",
    match: /\b(gym|work ?out|workouts?|fitness|exercis\w*|training|health|healthy|sleep|diet|meal prep|yoga|pilates)\b/i,
    help: "sticking to your workouts and routines",
    goal: "Stick to healthy routines",
    reminders: [
      { title: "Workout", when: "Weekdays · 6:30am" },
      { title: "Wind down, lights out soon", when: "Nightly · 10:30pm" },
    ],
    names: ["Pace", "Sol"],
  },
  {
    id: "household",
    match: /\b(kids?|children|family|household|groceries|grocery|chores|laundry|school run|pick-?ups?|daycare)\b/i,
    help: "keeping the household running",
    goal: "Keep the household running",
    reminders: [
      { title: "Weekly grocery order", when: "Thursdays · 7pm" },
      { title: "Family calendar check", when: "Sundays · 6pm" },
    ],
    names: ["Wren", "Juno"],
  },
  {
    id: "clients",
    match: /\b(clients?|invoic\w*|payments?|freelanc\w*|customers?|proposals?|contracts?)\b/i,
    help: "chasing invoices and following up with clients",
    goal: "Stay on top of clients and invoices",
    reminders: [
      { title: "Send outstanding invoices", when: "1st of the month · 10am" },
      { title: "Follow up on late payments", when: "Fridays · 11am" },
    ],
    names: ["Atlas", "Kit"],
  },
  {
    id: "school",
    match: /\b(school|class(?:es)?|exams?|homework|study|studying|uni|university|college|assignments?|thesis|lectures?)\b/i,
    help: "keeping up with school",
    goal: "Keep up with school",
    reminders: [
      { title: "Review this week's deadlines", when: "Sundays · 5pm" },
      { title: "Study block", when: "Weekdays · 7pm" },
    ],
    names: ["Kit", "Nudge"],
  },
  {
    id: "travel",
    match: /\b(travel\w*|flights?|trips?|hotels?|vacation|holiday)\b/i,
    help: "planning travel",
    goal: "Make travel painless",
    reminders: [
      { title: "Check in for your flight", when: "24h before departure" },
      { title: "Packing list", when: "Night before trips" },
    ],
    names: ["Orbit", "Sol"],
  },
  {
    id: "money",
    match: /\b(bills?|subscriptions?|budget\w*|money|finances?|expenses?|taxes|savings?|spending)\b/i,
    help: "keeping bills and subscriptions in check",
    goal: "Keep money admin in check",
    reminders: [
      { title: "Review subscriptions", when: "Monthly · 1st" },
      { title: "Pay upcoming bills", when: "Mondays · 9am" },
    ],
    names: ["Sol", "Atlas"],
  },
  {
    id: "reminders",
    match: /\b(remind\w*|remember\w*|forget\w*|forgot|birthdays?)\b/i,
    help: "remembering the little things",
    goal: "Remember the little things",
    reminders: [
      { title: "Morning brief", when: "Daily · 8am" },
      { title: "Birthdays & important dates", when: "Day before" },
    ],
    names: ["Nudge", "Echo"],
  },
  {
    id: "focus",
    match:
      /\b(focus\w*|procrastinat\w*|distract\w*|organi[sz]\w*|productiv\w*|overwhelm\w*|to-?dos?|priorit\w*|on track|accountab\w*|motivat\w*)\b/i,
    help: "staying focused and organized",
    goal: "Stay focused and organized",
    reminders: [
      { title: "Plan tomorrow's top 3", when: "Daily · 9pm" },
      { title: "Deep-work block", when: "Weekdays · 9am" },
    ],
    names: ["Nudge", "Pace"],
  },
  {
    id: "lifeadmin",
    match: /\b(life admin|errands|admin|paperwork|forms|returns|dentist|doctor)\b/i,
    help: "keeping life admin moving",
    goal: "Keep life admin moving",
    reminders: [
      { title: "Clear one admin task", when: "Weekdays · 12pm" },
      { title: "Weekly reset", when: "Sundays · 6pm" },
    ],
    names: ["Nudge", "Orbit"],
  },
];

export const NEED_BY_ID = Object.fromEntries(NEEDS.map((n) => [n.id, n])) as Record<NeedId, NeedDef>;

/** Product-safe default name pool (no celebrities, public figures or existing assistants). */
export const DEFAULT_AGENT_NAMES = ["Atlas", "Nudge", "Orbit", "Nova", "Pace", "Sol", "Wren", "Echo", "Kit", "Juno"];

export const GENERIC_REMINDERS: Reminder[] = [
  { title: "Morning brief", when: "Daily · 8am" },
  { title: "Plan tomorrow's top 3", when: "Daily · 9pm" },
  { title: "Weekly reset", when: "Sundays · 6pm" },
];

/**
 * Names we never suggest or accept: celebrities, public figures, and
 * existing assistant brands. Not exhaustive — a guard for the common cases.
 */
const BLOCKED_NAMES = new Set(
  [
    "siri", "alexa", "cortana", "bixby", "jarvis", "friday", "gemini", "claude", "chatgpt", "gpt", "copilot",
    "hal", "samantha", "elon", "musk", "oprah", "beyonce", "beyoncé", "rihanna", "drake", "kanye", "ye",
    "taylor", "swift", "adele", "madonna", "shakira", "zendaya", "obama", "trump", "biden", "einstein",
    "tesla", "jobs", "gates", "bezos", "zuckerberg", "kardashian", "kim", "kylie", "messi", "ronaldo",
    "lebron", "serena", "persona",
  ].map((n) => n.toLowerCase()),
);

export function isBlockedAgentName(name: string): boolean {
  return name
    .toLowerCase()
    .split(/[\s-]+/)
    .some((part) => BLOCKED_NAMES.has(part));
}
