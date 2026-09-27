import { describe, expect, it } from "vitest";
import { extract, finishEarly, initialEngine, respond, resumeTurn, type EngineState } from "@/lib/conversation/engine";
import { fallbackUnderstanding, fallbackFromMessages } from "@/lib/conversation/fallback";
import { SAMPLE_ANSWER } from "@/lib/conversation/samples";
import { UnderstandingSchema } from "@/lib/schema";

function run(...turns: string[]) {
  let state: EngineState = initialEngine();
  const replies: string[] = [];
  for (const t of turns) {
    const r = respond(state, t);
    state = r.state;
    replies.push(r.reply);
  }
  return { state, replies };
}

describe("dialogue engine", () => {
  it("finishes in one turn when the user gives everything at once", () => {
    const { state, replies } = run(SAMPLE_ANSWER);
    expect(state.done).toBe(true);
    expect(state.slots.name).toBe("Maya");
    expect(state.slots.needs.slice(0, 2)).toEqual(["content", "launch"]);
    expect(state.slots.project).toBe("building your fashion brand");
    expect(replies[0]).toMatch(/^nice to meet you, Maya\./);
    expect(replies[0]).toMatch(/staying consistent with content and keeping launch tasks moving/);
    expect(replies[0]).toMatch(/i've got what i need/);
  });

  it("acknowledges what it heard, then asks only for what's missing", () => {
    const first = run("i'm a nurse on night shifts and i keep forgetting bills and birthdays");
    expect(first.state.done).toBe(false);
    expect(first.replies[0]).toMatch(/^a nurse on night shifts, nice\./);
    expect(first.replies[0]).toMatch(/so you want help/);
    expect(first.replies[0]).toMatch(/what should i call you\?$/);
    const second = run("i'm a nurse on night shifts and i keep forgetting bills and birthdays", "it's priya");
    expect(second.state.slots.name).toBe("Priya");
    expect(second.state.done).toBe(true);
  });

  it("handles messy / unrelated answers without getting stuck", () => {
    const { state, replies } = run("ugh honestly idk lol", "what's the weather like?", "whatever");
    expect(replies[0]).toMatch(/^ha, fair enough\. what's the one thing/);
    expect(replies[1]).toMatch(/good question/);
    // after two misses on the need it moves on instead of trapping the user
    expect(state.slots.needs).toEqual(["lifeadmin"]);
    expect(replies[2]).toMatch(/general life admin/);
  });

  it("lets the user change their name", () => {
    const { state, replies } = run(
      "hey i'm Sam, i need help with my inbox, i'm a freelance designer",
      "actually call me Samira",
    );
    expect(state.slots.name).toBe("Samira");
    expect(replies[1]).toMatch(/^got it, Samira it is\./);
  });

  it("detects a correction phrased as 'not X, it's Y'", () => {
    const heard = extract("not Sam, it's Samuel", { currentName: "Sam" });
    expect(heard.name).toBe("Samuel");
    expect(heard.nameChanged).toBe(true);
  });

  it("does not mistake ordinary phrases for names or projects", () => {
    const heard = extract("i'm tired and i'm running late for everything, i'm starting to feel behind");
    expect(heard.name).toBeUndefined();
    expect(heard.project).toBeUndefined();
  });

  it("skips the context question when context was already given", () => {
    const { state } = run("I'm Leo. I'm launching a coffee cart and need help with invoices");
    expect(state.done).toBe(true);
    expect(state.asked.context).toBe(0);
  });

  it("asks for context once, and doesn't force it", () => {
    const { state, replies } = run("call me Ana, i want help with my calendar", "not sure");
    expect(replies[0]).toMatch(/when are you usually busiest/);
    expect(replies[1]).toMatch(/^all good\./);
    expect(state.done).toBe(true);
  });

  it("lets the user finish early", () => {
    const partial = run("i need help with content").state;
    const turn = finishEarly(partial);
    expect(turn.state.done).toBe(true);
    expect(turn.reply).toMatch(/plenty to start with/);
  });

  it("resumes gracefully after a hang-up", () => {
    const hungUp = run("i need help with content").state;
    const resumed = resumeTurn(hungUp);
    expect(resumed.reply).toMatch(/^welcome back\. picking up where we left off: /);
    expect(resumed.state.lastAsked).toBe("name");

    const early = resumeTurn(initialEngine());
    expect(early.reply).toMatch(/what does a normal day look like/);
  });

  it("reopens the floor when coming back to add something", () => {
    const complete = run(SAMPLE_ANSWER).state;
    const reopened = resumeTurn({ ...complete, done: false });
    expect(reopened.reply).toBe("welcome back, Maya. anything else i should know?");
    const added = respond(reopened.state, "oh and i always forget my mom's birthday");
    expect(added.state.slots.needs).toContain("reminders");
    expect(added.state.done).toBe(true);
    const nothing = respond(reopened.state, "nope that's it");
    expect(nothing.reply).toMatch(/^all good\./);
    expect(nothing.state.done).toBe(true);
  });
});

describe("fallback understanding", () => {
  it("builds a schema-valid understanding from the sample", () => {
    const u = fallbackFromMessages([{ id: "1", role: "user", text: SAMPLE_ANSWER }]);
    expect(UnderstandingSchema.safeParse(u).success).toBe(true);
    expect(u.userName).toBe("Maya");
    expect(u.summary).toBe(
      "you're building your fashion brand, and you want help staying consistent with content and keeping launch tasks moving.",
    );
    expect(u.primaryGoal).toBe("Stay consistent with content");
    expect(u.suggestedAgentNames).toHaveLength(3);
    expect(new Set(u.suggestedAgentNames).size).toBe(3);
    expect(u.suggestedReminders).toHaveLength(3);
  });

  it("is valid even with nothing to go on", () => {
    const u = fallbackUnderstanding({ needs: [], routines: [] });
    expect(UnderstandingSchema.safeParse(u).success).toBe(true);
    expect(u.userName).toBe("");
  });
});
