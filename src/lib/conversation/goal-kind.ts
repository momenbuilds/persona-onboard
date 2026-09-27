/**
 * What kind of goal the user is chasing, so the progress chart talks about the
 * right thing: their income, their growth, their job search… or, by default,
 * the busywork Persona takes off their plate.
 */
export type GoalKind = "money" | "career" | "growth" | "health" | "learning" | "time";

const RULES: [GoalKind, RegExp][] = [
  ["money", /\b(money|income|revenue|earn\w*|salary|profit\w*|sales|financ\w*|paid|rich|invoices?|pay\s?raise)\b|\$/i],
  ["career", /\b(job|jobs|hired|hiring|career|role|interview\w*|promotion|offer|founding engineer|internship)\b/i],
  ["growth", /\b(users?|followers?|audience|grow\w*|launch\w*|customers?|subscribers?|brand|startup|scale|mrr)\b/i],
  ["health", /\b(gym|fitness|work ?outs?|health\w*|weight|sleep|running|diet|exercis\w*|marathon)\b/i],
  ["learning", /\b(school|class\w*|exams?|grades?|study\w*|degree|learn\w*|courses?|gpa|thesis)\b/i],
];

/** The main goal decides; the rest of what they said only breaks a tie. */
export function goalKind(primaryGoal: string, context = ""): GoalKind {
  for (const text of [primaryGoal, context]) {
    const hit = RULES.find(([, re]) => re.test(text));
    if (hit) return hit[0];
  }
  return "time";
}

export type GoalChart = {
  /** Chart title, like the metric on a progress chart. */
  title: string;
  /** Short badge next to the Persona label. */
  badge: string;
  /** true: the Persona line climbs. false: it drops (less busywork is better). */
  upIsGood: boolean;
  /** The line for doing it without Persona. */
  aloneLabel: string;
  /** One sentence under the chart. */
  caption: string;
};

export const GOAL_CHARTS: Record<GoalKind, GoalChart> = {
  time: {
    title: "Your busywork",
    badge: "Hours",
    upIsGood: false,
    aloneLabel: "On your own",
    caption: "with Persona, busywork keeps shrinking. on your own, it quietly creeps back.",
  },
  money: {
    title: "Your income",
    badge: "Money",
    upIsGood: true,
    aloneLabel: "On your own",
    caption: "the hours Persona frees up go back into what actually earns. on your own, admin eats them.",
  },
  career: {
    title: "Your job search",
    badge: "Career",
    upIsGood: true,
    aloneLabel: "On your own",
    caption: "with Persona, applications, follow-ups and interviews stay on track. on your own, they slip.",
  },
  growth: {
    title: "Your growth",
    badge: "Growth",
    upIsGood: true,
    aloneLabel: "On your own",
    caption: "with Persona, momentum compounds. on your own, it stalls every time the busywork piles up.",
  },
  health: {
    title: "Your routine",
    badge: "Health",
    upIsGood: true,
    aloneLabel: "On your own",
    caption: "with Persona, the routine sticks. on your own, it fades after the first few weeks.",
  },
  learning: {
    title: "Your school work",
    badge: "School",
    upIsGood: true,
    aloneLabel: "On your own",
    caption: "with Persona, deadlines land on time. on your own, they pile up before exams.",
  },
};
