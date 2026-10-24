import "server-only";
import { and, desc, eq, gte, lte, gt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { LootCondition, QuestPrep, Tier } from "@/db/schema";
import { scoreEvents } from "./scoring";
import { computeStreak, levelFromXp, xpForLevel } from "./progress";
import { addDays, dayKey, weekStart } from "../time";

const { events, rules, modifiers, quests, bosses, loot, proofItems, gmMessages, syncState, users } = schema;

/**
 * Re-run the scoring engine over recent events and persist the results.
 * Caps are per day and modifiers are time-boxed, so rescoring whole days is exact.
 */
export async function rescoreRecent(days = 14): Promise<void> {
  const db = getDb();
  const since = new Date(`${addDays(dayKey(new Date()), -days)}T00:00:00Z`);
  const [evs, rs, ms] = await Promise.all([
    db.select().from(events).where(gte(events.occurredAt, since)),
    db.select().from(rules),
    db.select().from(modifiers).where(gt(modifiers.endsAt, since)),
  ]);
  const scores = scoreEvents(evs, rs, ms);
  for (const e of evs) {
    const s = scores.get(e.id)!;
    const changed =
      s.points !== e.points ||
      s.tier !== e.tier ||
      s.ruleId !== e.ruleId ||
      JSON.stringify(s.modifierIds) !== JSON.stringify(e.modifierIds);
    if (changed) await db.update(events).set(s).where(eq(events.id, e.id));
  }
}

export type QuestView = {
  id: string;
  title: string;
  why: string;
  tier: Tier;
  source: string;
  points: number;
  multiplier: number | null;
  done: boolean;
  manual: boolean;
  progress: number;
  targetCount: number;
  prep: QuestPrep;
};

export type GameState = Awaited<ReturnType<typeof loadGameState>>;

export async function loadGameState(userId: string, now = new Date()) {
  const db = getDb();
  const today = dayKey(now);
  const monday = weekStart(today);
  const streakWindowStart = new Date(`${addDays(today, -120)}T00:00:00Z`);

  const [
    [me],
    [xpRow],
    recentEvents,
    todaysQuests,
    recentQuestDays,
    activeMods,
    allRules,
    [boss],
    myLoot,
    proofs,
    [brief],
    [pattern],
    syncs,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select({ xp: sql<number>`coalesce(sum(${events.points}), 0)::int` }).from(events).where(eq(events.userId, userId)),
    db.select().from(events).where(gte(events.occurredAt, streakWindowStart)),
    db.select().from(quests).where(and(eq(quests.userId, userId), eq(quests.date, today))).orderBy(quests.position),
    db
      .select({ date: quests.date, done: sql<number>`count(*) filter (where ${quests.status} = 'done')::int` })
      .from(quests)
      .where(and(eq(quests.userId, userId), gte(quests.date, addDays(today, -120))))
      .groupBy(quests.date),
    db.select().from(modifiers).where(and(lte(modifiers.startsAt, now), gt(modifiers.endsAt, now))),
    db.select().from(rules),
    db.select().from(bosses).where(eq(bosses.status, "active")).orderBy(desc(bosses.startedAt)).limit(1),
    db.select().from(loot).where(eq(loot.userId, userId)),
    db.select().from(proofItems).orderBy(desc(proofItems.createdAt)).limit(3),
    db.select().from(gmMessages).where(and(eq(gmMessages.userId, userId), eq(gmMessages.kind, "brief"))).orderBy(desc(gmMessages.createdAt)).limit(1),
    db
      .select()
      .from(gmMessages)
      .where(and(eq(gmMessages.userId, userId), eq(gmMessages.kind, "pattern"), gte(gmMessages.createdAt, new Date(now.getTime() - 7 * 864e5))))
      .orderBy(desc(gmMessages.createdAt))
      .limit(1),
    db.select().from(syncState),
  ]);

  const myEvents = recentEvents.filter((e) => e.userId === userId);
  const xp = xpRow?.xp ?? 0;
  const lvl = levelFromXp(xp);
  const todayPoints = myEvents.filter((e) => dayKey(e.occurredAt) === today).reduce((s, e) => s + e.points, 0);

  // Streak: a day counts with ≥1 scoring Cash/Pipeline event or ≥2 quests done.
  const activeDays = new Set<string>();
  for (const e of myEvents) {
    if ((e.tier === "cash" || e.tier === "pipeline") && e.points > 0) activeDays.add(dayKey(e.occurredAt));
  }
  for (const q of recentQuestDays) if (q.done >= 2) activeDays.add(q.date);
  const streak = computeStreak(activeDays, today);

  // This week by tier (mine), plus the co-op total for both founders.
  const weekEvents = recentEvents.filter((e) => dayKey(e.occurredAt) >= monday);
  const tierTotals: Record<Tier, number> = { cash: 0, pipeline: 0, groundwork: 0, zero: 0 };
  const tierCounts: Record<Tier, number> = { cash: 0, pipeline: 0, groundwork: 0, zero: 0 };
  for (const e of weekEvents.filter((e) => e.userId === userId)) {
    tierTotals[e.tier] += e.points;
    tierCounts[e.tier] += 1;
  }
  const coopWeek = weekEvents.reduce((s, e) => s + e.points, 0);

  // Boss: shared; each scoring damage event since it started deals 1 damage.
  let bossView = null;
  if (boss) {
    const damage = recentEvents.filter(
      (e) => e.type === boss.damageEventType && e.points > 0 && e.occurredAt >= boss.startedAt,
    ).length;
    bossView = { ...boss, hp: Math.max(0, boss.maxHp - damage) };
  }

  const ruleByType = new Map(allRules.map((r) => [r.eventType, r]));
  const multiplierFor = (tier: Tier, eventType: string) => {
    const m = activeMods
      .filter((m) => m.kind === "multiplier" && (m.target === tier || m.target === eventType))
      .sort((a, b) => b.value - a.value)[0];
    return m ? m.value : null;
  };

  const questViews: QuestView[] = todaysQuests.map((q) => {
    const rule = ruleByType.get(q.ruleEventType);
    const mult = multiplierFor(q.tier, q.ruleEventType);
    const base = (rule?.basePoints ?? 0) * q.targetCount;
    const progress = myEvents.filter(
      (e) => e.type === q.ruleEventType && dayKey(e.occurredAt) === today && e.source !== "manual",
    ).length;
    return {
      id: q.id,
      title: q.title,
      why: q.why,
      tier: q.tier,
      source: q.source,
      points: Math.round(base * (mult ?? 1)),
      multiplier: mult,
      done: q.status === "done" || progress >= q.targetCount,
      manual: q.status === "done" && q.completedByEventId !== null && progress < q.targetCount,
      progress: Math.min(progress, q.targetCount),
      targetCount: q.targetCount,
      prep: q.prep,
    };
  });

  const lootViews = myLoot.map((l) => {
    const status = lootStatus(l.unlockCondition, {
      xp,
      level: lvl.level,
      streak: streak.current,
      bossDefeated: bossView?.hp === 0,
      cashWeek: tierTotals.cash,
    });
    return { id: l.id, name: l.name, unlocked: l.unlockedAt !== null || status.unlocked, status: status.label };
  });

  const lastSync = syncs
    .map((s) => s.lastSyncedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    me: me ? { id: me.id, name: me.name, email: me.email } : null,
    today,
    level: lvl.level,
    xpIntoLevel: lvl.xpIntoLevel,
    xpForNext: lvl.xpForNext,
    totalXp: xp,
    todayPoints,
    streak,
    tiers: (["cash", "pipeline", "groundwork", "zero"] as const).map((t) => ({
      tier: t,
      points: tierTotals[t],
      count: tierCounts[t],
    })),
    coopWeek,
    boss: bossView,
    modifiers: activeMods.map((m) => ({
      id: m.id,
      kind: m.kind,
      target: m.target,
      value: m.value,
      reason: m.reason,
      setBy: m.setBy,
      endsAt: m.endsAt.toISOString(),
    })),
    quests: questViews,
    loot: lootViews,
    proofs: proofs.map((p) => ({ id: p.id, kind: p.kind, text: p.text })),
    brief: brief ? { title: brief.title, content: brief.content, createdAt: brief.createdAt.toISOString() } : null,
    pattern: pattern ? { title: pattern.title, content: pattern.content } : null,
    lastSync: lastSync?.toISOString() ?? null,
  };
}

function lootStatus(
  c: LootCondition,
  s: { xp: number; level: number; streak: number; bossDefeated: boolean; cashWeek: number },
): { unlocked: boolean; label: string } {
  switch (c.type) {
    case "level":
      return s.level >= c.level
        ? { unlocked: true, label: "unlocked" }
        : { unlocked: false, label: `${xpForLevel(c.level) - s.xp} XP to go` };
    case "streak":
      return s.streak >= c.days
        ? { unlocked: true, label: "unlocked" }
        : { unlocked: false, label: `${c.days - s.streak}-day streak to go` };
    case "boss_defeated":
      return { unlocked: s.bossDefeated, label: s.bossDefeated ? "unlocked" : "beat the boss" };
    case "cash_points_week":
      return s.cashWeek >= c.points
        ? { unlocked: true, label: "unlocked" }
        : { unlocked: false, label: `${c.points - s.cashWeek} Cash pts this week` };
  }
}

