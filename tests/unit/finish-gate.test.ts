import { describe, expect, it } from "vitest";
import { reviewFinish } from "@/lib/conversation/finish-gate";

const full = {
  userName: "Momen",
  needs: "keeping up with slack threads",
  goals: "ship the v2 launch by november",
  routine: "meetings all morning, deep work after 3pm",
  user_wants_to_stop: false,
};

describe("finish_onboarding gate", () => {
  it("rejects an early finish after one short answer and names the next question", () => {
    const d = reviewFinish({ userName: "Momen", needs: "Slack", goals: "", routine: "", user_wants_to_stop: false }, false);
    expect(d.accept).toBe(false);
    if (d.accept) return;
    expect(d.missing).toEqual(["goals", "routine"]);
    expect(d.result.ok).toBe(false);
    expect(String(d.result.instruction)).toMatch(/working toward/);
  });

  it("treats placeholder values as missing", () => {
    const d = reviewFinish({ ...full, goals: "not mentioned", routine: "N/A" }, false);
    expect(d.accept).toBe(false);
    if (!d.accept) expect(d.missing).toEqual(["goals", "routine"]);
  });

  it("accepts once all four items are filled in", () => {
    expect(reviewFinish(full, false)).toEqual({ accept: true });
  });

  it("always accepts when the user asked to stop", () => {
    expect(reviewFinish({ needs: "email" }, true)).toEqual({ accept: true });
    expect(reviewFinish({ needs: "email", user_wants_to_stop: true }, false)).toEqual({ accept: true });
  });
});
