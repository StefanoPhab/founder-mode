import { describe, expect, it } from "vitest";
import { computeStreak, levelFromXp, xpForLevel } from "@/lib/game/progress";
import { validateAiModifier } from "@/lib/game/modifiers";

describe("level curve", () => {
  it("needs 500 + 250*(N-1) XP from level N", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 500 });
    expect(levelFromXp(499).level).toBe(1);
    expect(levelFromXp(500)).toEqual({ level: 2, xpIntoLevel: 0, xpForNext: 750 });
    expect(levelFromXp(1250)).toEqual({ level: 3, xpIntoLevel: 0, xpForNext: 1000 });
    expect(xpForLevel(3)).toBe(1250);
  });
});

describe("streak", () => {
  // 2026-10-19 is a Monday.
  const days = (...d: string[]) => new Set(d.map((x) => `2026-10-${x}`));

  it("counts consecutive active days and doesn't break on an open today", () => {
    expect(computeStreak(days("19", "20", "21"), "2026-10-22")).toMatchObject({ current: 3, longest: 3 });
  });

  it("Sundays are frozen for free", () => {
    // Fri 23, Sat 24, (Sun 25 skipped), Mon 26
    expect(computeStreak(days("23", "24", "26"), "2026-10-26")).toMatchObject({ current: 3, freezesLeft: 1 });
  });

  it("uses the week's one freeze, then breaks", () => {
    // Mon 19 active, Tue 20 missed (freeze), Wed 21 active, Thu 22 missed (no freeze left) → reset
    const s1 = computeStreak(days("19", "21"), "2026-10-21");
    expect(s1).toMatchObject({ current: 2, freezesLeft: 0 });
    const s2 = computeStreak(days("19", "21", "23"), "2026-10-23");
    expect(s2).toMatchObject({ current: 1, longest: 2 });
  });

  it("freezes refill each week", () => {
    // Missed Tue 20 (freeze wk1) and Tue 27 (freeze wk2)
    const s = computeStreak(days("19", "21", "22", "23", "24", "26", "28"), "2026-10-28");
    expect(s.current).toBe(7);
  });

  it("is empty with no activity", () => {
    expect(computeStreak(new Set(), "2026-10-22")).toEqual({ current: 0, longest: 0, freezesLeft: 1 });
  });
});

describe("AI modifier bounds", () => {
  const ok = { kind: "multiplier" as const, target: "cash", value: 2, hours: 48, reason: "Cash stalled 3 days" };
  it("accepts a valid request", () => expect(validateAiModifier(ok, 0)).toEqual({ ok: true }));
  it.each([
    [{ ...ok, value: 3 }, 0],
    [{ ...ok, hours: 49 }, 0],
    [{ ...ok, target: "zero" }, 0],
    [{ ...ok, kind: "cap" as const }, 0],
    [{ ...ok, reason: " " }, 0],
    [ok, 1],
  ])("rejects %j with %i active", (req, active) => {
    expect(validateAiModifier(req, active).ok).toBe(false);
  });
});

import { startOfDay } from "@/lib/time";
describe("startOfDay (Europe/Rome)", () => {
  it("handles summer and winter time", () => {
    expect(startOfDay("2026-07-01").toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(startOfDay("2026-12-01").toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });
});
