import { describe, expect, it } from "vitest";
import { scoreEvents, type ScorableEvent, type ScoringModifier } from "@/lib/game/scoring";
import { RULES, MANUAL_DAILY_CAP } from "@/lib/rules.config";

const rules = RULES.map((r) => ({ ...r, active: true }));
let n = 0;
const ev = (type: string, iso: string, extra: Partial<ScorableEvent> = {}): ScorableEvent => ({
  id: `e${String(n++).padStart(4, "0")}`,
  userId: "u1",
  source: "attio",
  type,
  occurredAt: new Date(iso),
  payload: {},
  ...extra,
});
const mod = (m: Partial<ScoringModifier>): ScoringModifier => ({
  id: "m1",
  kind: "multiplier",
  target: "cash",
  value: 2,
  startsAt: new Date("2026-10-20T00:00:00Z"),
  endsAt: new Date("2026-10-22T00:00:00Z"),
  ...m,
});

describe("scoreEvents", () => {
  it("scores by rule and tier", () => {
    const e = ev("trial_converted", "2026-10-20T10:00:00Z");
    expect(scoreEvents([e], rules, []).get(e.id)).toEqual({ points: 200, tier: "cash", ruleId: "cash.trial_converted", modifierIds: [] });
  });

  it("gives unknown and inactive event types zero", () => {
    const a = ev("made_a_slide_deck", "2026-10-20T10:00:00Z");
    const b = ev("positive_reply", "2026-10-20T10:00:00Z");
    const inactive = rules.map((r) => (r.eventType === "positive_reply" ? { ...r, active: false } : r));
    const s = scoreEvents([a, b], inactive, []);
    expect(s.get(a.id)).toMatchObject({ points: 0, tier: "zero", ruleId: null });
    expect(s.get(b.id)!.points).toBe(0);
  });

  it("forces tooling/planning/this-app tags to zero, whatever the type", () => {
    const e = ev("trial_converted", "2026-10-20T10:00:00Z", { payload: { tags: ["founder-mode"] } });
    expect(scoreEvents([e], rules, []).get(e.id)).toMatchObject({ points: 0, tier: "zero" });
  });

  it("applies the daily cap to the earliest events of the Rome day", () => {
    const evs = Array.from({ length: 35 }, (_, i) => ev("outbound_step_sent", `2026-10-20T${String(8 + Math.floor(i / 10)).padStart(2, "0")}:${String(i % 10).padStart(2, "0")}:00Z`));
    const s = scoreEvents([...evs].reverse(), rules, []);
    const total = evs.reduce((t, e) => t + s.get(e.id)!.points, 0);
    expect(total).toBe(30);
    expect(s.get(evs[0].id)!.points).toBe(1);
    expect(s.get(evs[34].id)!.points).toBe(0);
  });

  it("resets caps at midnight Europe/Rome, not UTC", () => {
    // 22:30Z on Oct 20 is 00:30 on Oct 21 in Rome (UTC+2).
    const day1 = Array.from({ length: 2 }, () => ev("proof_asset_created", "2026-10-20T12:00:00Z"));
    const late = ev("proof_asset_created", "2026-10-20T22:30:00Z");
    const s = scoreEvents([...day1, late], rules, []);
    expect(s.get(late.id)!.points).toBe(20);
  });

  it("caps manual events per user per day across rules", () => {
    const evs = Array.from({ length: MANUAL_DAILY_CAP + 2 }, (_, i) => ev("positive_reply", `2026-10-20T1${i}:00:00Z`, { source: "manual" }));
    const s = scoreEvents(evs, rules, []);
    expect(evs.filter((e) => s.get(e.id)!.points > 0)).toHaveLength(MANUAL_DAILY_CAP);
  });

  it("caps are per user", () => {
    const a = Array.from({ length: 3 }, () => ev("proof_asset_created", "2026-10-20T10:00:00Z", { userId: "u1" }));
    const b = Array.from({ length: 3 }, () => ev("proof_asset_created", "2026-10-20T10:00:00Z", { userId: "u2" }));
    const s = scoreEvents([...a, ...b], rules, []);
    expect([...s.values()].reduce((t, x) => t + x.points, 0)).toBe(80);
  });

  it("applies an active multiplier on the tier, only inside its window", () => {
    const inside = ev("client_why_logged", "2026-10-21T10:00:00Z");
    const after = ev("client_why_logged", "2026-10-22T10:00:00Z");
    const s = scoreEvents([inside, after], rules, [mod({})]);
    expect(s.get(inside.id)).toMatchObject({ points: 100, modifierIds: ["m1"] });
    expect(s.get(after.id)).toMatchObject({ points: 50, modifierIds: [] });
  });

  it("uses only the largest multiplier when several apply", () => {
    const e = ev("positive_reply", "2026-10-21T10:00:00Z");
    const s = scoreEvents([e], rules, [mod({ id: "a", target: "pipeline", value: 1.5 }), mod({ id: "b", target: "positive_reply", value: 2 })]);
    expect(s.get(e.id)).toMatchObject({ points: 30, modifierIds: ["b"] });
  });

  it("cap modifiers limit a target's daily total", () => {
    const evs = Array.from({ length: 5 }, (_, i) => ev("positive_reply", `2026-10-21T1${i}:00:00Z`));
    const s = scoreEvents(evs, rules, [mod({ kind: "cap", target: "pipeline", value: 40 })]);
    expect(evs.map((e) => s.get(e.id)!.points)).toEqual([15, 15, 10, 0, 0]);
  });

  it("is deterministic regardless of input order", () => {
    const evs = Array.from({ length: 40 }, (_, i) => ev(i % 2 ? "outbound_step_sent" : "icp_task_closed", `2026-10-21T0${i % 10}:${String(i).padStart(2, "0")}:00Z`));
    const a = scoreEvents(evs, rules, [mod({ target: "groundwork" })]);
    const b = scoreEvents([...evs].reverse(), rules, [mod({ target: "groundwork" })]);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });
});
