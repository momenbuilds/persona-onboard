import { describe, expect, it } from "vitest";
import { GOAL_CHARTS, goalKind } from "@/lib/conversation/goal-kind";

describe("goal kind for the progress chart", () => {
  it("reads the main goal first", () => {
    expect(goalKind("Grow and make more money")).toBe("money");
    expect(goalKind("Land a founding engineer job")).toBe("career");
    expect(goalKind("Reach 10k users by December")).toBe("growth");
    expect(goalKind("Stick to my workouts")).toBe("health");
    expect(goalKind("Pass my exams in June")).toBe("learning");
  });

  it("falls back to the rest of the call, then to time saved", () => {
    expect(goalKind("Stay consistent", "building my fashion brand")).toBe("growth");
    expect(goalKind("Feel less scattered", "nothing specific")).toBe("time");
  });

  it("busywork goes down; everything else goes up", () => {
    expect(GOAL_CHARTS.time.upIsGood).toBe(false);
    for (const kind of ["money", "career", "growth", "health", "learning"] as const) expect(GOAL_CHARTS[kind].upIsGood).toBe(true);
  });
});
