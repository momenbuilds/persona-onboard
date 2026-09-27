import type { InboxEmail } from "@/lib/schema";

/**
 * DEMO inbox template: shown instantly while the personalized one is generated
 * (and used on its own when there's no model). It always carries a deck about
 * the user's main goal, so "make a PDF of the deck in my email" works from the start.
 */
export type InboxContext = { userName: string; summary: string; primaryGoal: string; secondaryGoals: string[]; notes?: Record<string, string> };

export function templateInbox(ctx: InboxContext): InboxEmail[] {
  const name = ctx.userName || "there";
  return [
    {
      id: "e1",
      from: "Alex Rivera",
      subject: `${ctx.primaryGoal} — draft deck for review`,
      date: "Mon 9:12am",
      snippet: "Attached the draft deck. Can you take a pass before Thursday?",
      body: `Hi ${name}, attached the draft deck for Thursday. Could you tighten the timeline and add anything missing on risks? Thanks, Alex`,
      attachment: {
        name: "review-deck.key",
        kind: "deck",
        content: `Slide 1: ${ctx.primaryGoal}\nSlide 2: Where we are today\nSlide 3: Timeline and milestones\nSlide 4: Risks and open questions\nSlide 5: Asks and next steps`,
      },
    },
    {
      id: "e2",
      from: "Jordan Lee",
      subject: "Quick sync this week?",
      date: "Tue 4:40pm",
      snippet: "Do you have 20 minutes Wednesday or Thursday?",
      body: `Hey ${name}, do you have 20 minutes Wednesday or Thursday to catch up? Happy to work around your calendar.`,
      attachment: null,
    },
    {
      id: "e3",
      from: "Finance",
      subject: "Invoice #1042 due Friday",
      date: "Wed 8:05am",
      snippet: "Reminder: invoice #1042 for $1,240 is due this Friday.",
      body: "Reminder that invoice #1042 for $1,240.00 is due this Friday. Reply if anything looks off.",
      attachment: null,
    },
    {
      id: "e4",
      from: "Sam Okafor",
      subject: "Notes from yesterday",
      date: "Wed 6:18pm",
      snippet: "Three action items from our call…",
      body: "Thanks for the call. Action items: 1) share the updated plan, 2) confirm owners for each milestone, 3) set the next check-in.",
      attachment: null,
    },
  ];
}
