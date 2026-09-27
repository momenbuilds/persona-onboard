import { describe, expect, it } from "vitest";
import { clampSavings, fallbackSavings, formatHours, shortHours, totals } from "@/lib/conversation/savings";

describe("time savings", () => {
  it("keeps model numbers believable: never all of a task, never absurd hours", () => {
    const [a, b] = clampSavings([
      { task: "Email", manualHours: 40, withPersonaHours: 0 },
      { task: "Slack replies", manualHours: 3, withPersonaHours: 3 },
    ]);
    expect(a).toEqual({ task: "Email", manualHours: 12, withPersonaHours: 2.5 });
    expect(b.withPersonaHours).toBeLessThan(b.manualHours);
  });

  it("drops duplicates and caps at five tasks", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ task: `Task ${i % 6}`, manualHours: 2, withPersonaHours: 1 }));
    expect(clampSavings(many)).toHaveLength(5);
  });

  it("estimates from the user's words without a model", () => {
    const items = fallbackSavings("i miss slack and email replies and school deadlines keep slipping");
    expect(items.map((i) => i.task)).toEqual(expect.arrayContaining(["Email and replies", "Keeping up with school"]));
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(totals(items).savedWeek).toBeGreaterThan(0);
  });

  it("falls back to general tasks when nothing matches", () => {
    expect(fallbackSavings("hmm not sure").length).toBe(3);
  });

  it("totals and formats hours", () => {
    const t = totals([
      { task: "A", manualHours: 5, withPersonaHours: 1.5 },
      { task: "B", manualHours: 2, withPersonaHours: 0.75 },
    ]);
    // 3.5 + 1.25 = 4.75, shown to the nearest half hour.
    expect(t.savedWeek).toBe(5);
    expect(t.savedMonth).toBe(22);
    expect(formatHours(4.5)).toBe("4.5 hours");
    expect(formatHours(1)).toBe("1 hour");
    expect(formatHours(0.5)).toBe("30 min");
    expect(shortHours(1.25)).toBe("1.25h");
    expect(shortHours(0.75)).toBe("45m");
  });
});
