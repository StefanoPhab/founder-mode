import type { Tier } from "@/db/schema";
import { MANUAL_DAILY_CAP, ZERO_TAGS } from "../rules.config";
import { dayKey } from "../time";

// Deterministic scoring. Pure: same inputs, same points. The LLM never touches this.

export type ScoringRule = {
  id: string;
  eventType: string;
  tier: Tier;
  basePoints: number;
  dailyCap: number | null;
  active: boolean;
};

export type ScoringModifier = {
  id: string;
  kind: "multiplier" | "cap";
  target: string; // tier or event type
  value: number;
  startsAt: Date;
  endsAt: Date;
};

export type ScorableEvent = {
  id: string;
  userId: string;
  source: string;
  type: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
};

export type Score = {
  points: number;
  tier: Tier;
  ruleId: string | null;
  modifierIds: string[];
};

const ZERO: Omit<Score, "ruleId"> = { points: 0, tier: "zero", modifierIds: [] };

function hasZeroTag(payload: Record<string, unknown>): boolean {
  const tags = payload.tags;
  return Array.isArray(tags) && tags.some((t) => typeof t === "string" && ZERO_TAGS.includes(t));
}

function activeAt(m: ScoringModifier, at: Date): boolean {
  return m.startsAt <= at && at < m.endsAt;
}

function targets(m: ScoringModifier, rule: ScoringRule): boolean {
  return m.target === rule.tier || m.target === rule.eventType;
}

/**
 * Score a batch of events. Events are processed in time order so daily caps
 * apply to the earliest events of the day. Returns a map keyed by event id.
 */
export function scoreEvents(
  events: ScorableEvent[],
  rules: ScoringRule[],
  modifiers: ScoringModifier[],
): Map<string, Score> {
  const ruleByType = new Map(rules.map((r) => [r.eventType, r]));
  const sorted = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id),
  );

  const ruleCount = new Map<string, number>(); // user|day|rule -> scoring events so far
  const manualCount = new Map<string, number>(); // user|day -> scoring manual events so far
  const capTotals = new Map<string, number>(); // user|day|modifier -> points so far under a cap
  const out = new Map<string, Score>();

  for (const e of sorted) {
    const rule = ruleByType.get(e.type);
    if (!rule || !rule.active || hasZeroTag(e.payload)) {
      out.set(e.id, { ...ZERO, ruleId: rule?.id ?? null });
      continue;
    }
    const day = dayKey(e.occurredAt);
    const rk = `${e.userId}|${day}|${rule.id}`;
    const mk = `${e.userId}|${day}`;
    const used = ruleCount.get(rk) ?? 0;
    const manualUsed = manualCount.get(mk) ?? 0;

    const overRuleCap = rule.dailyCap !== null && used >= rule.dailyCap;
    const overManualCap = e.source === "manual" && manualUsed >= MANUAL_DAILY_CAP;
    if (overRuleCap || overManualCap || rule.tier === "zero") {
      out.set(e.id, { points: 0, tier: rule.tier, ruleId: rule.id, modifierIds: [] });
      continue;
    }
    ruleCount.set(rk, used + 1);
    if (e.source === "manual") manualCount.set(mk, manualUsed + 1);

    const applicable = modifiers.filter((m) => activeAt(m, e.occurredAt) && targets(m, rule));
    const modifierIds: string[] = [];

    // At most one multiplier applies: the largest.
    let points = rule.basePoints;
    const mult = applicable
      .filter((m) => m.kind === "multiplier")
      .sort((a, b) => b.value - a.value)[0];
    if (mult) {
      points = Math.round(points * mult.value);
      modifierIds.push(mult.id);
    }

    // Caps limit the day's total points for their target.
    for (const cap of applicable.filter((m) => m.kind === "cap")) {
      const ck = `${e.userId}|${day}|${cap.id}`;
      const soFar = capTotals.get(ck) ?? 0;
      const allowed = Math.max(0, Math.min(points, cap.value - soFar));
      if (allowed < points) modifierIds.push(cap.id);
      points = allowed;
      capTotals.set(ck, soFar + points);
    }

    out.set(e.id, { points, tier: rule.tier, ruleId: rule.id, modifierIds });
  }
  return out;
}
