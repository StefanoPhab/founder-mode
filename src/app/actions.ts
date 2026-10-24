"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { loadGameState, rescoreRecent } from "@/lib/game/state";
import { gmConfigured, gmReply } from "@/lib/gm/answer";
import { loadThread } from "@/lib/gm/thread";

const { quests, events, icpCandidates, gmMessages } = schema;

/**
 * Manual fallback for single-step quests: checking one logs a manual event of the
 * quest's rule (manual events are capped by the scoring engine); unchecking removes it.
 * Multi-step quests (e.g. 25 ICP decisions) only complete from tracked events.
 */
export async function toggleQuest(questId: string) {
  const user = await requireUser();
  const db = getDb();
  const [q] = await db.select().from(quests).where(and(eq(quests.id, questId), eq(quests.userId, user.id)));
  if (!q || q.targetCount > 1) return;

  if (q.status === "done") {
    await db.update(quests).set({ status: "open", completedByEventId: null }).where(eq(quests.id, q.id));
    await db.delete(events).where(and(eq(events.source, "manual"), eq(events.sourceId, `quest:${q.id}`)));
  } else {
    const [e] = await db
      .insert(events)
      .values({
        userId: user.id,
        source: "manual",
        sourceId: `quest:${q.id}`,
        type: q.ruleEventType,
        occurredAt: new Date(),
        payload: { questId: q.id, note: "Marked done by hand" },
      })
      .onConflictDoUpdate({ target: [events.source, events.sourceId], set: { occurredAt: new Date() } })
      .returning();
    await db.update(quests).set({ status: "done", completedByEventId: e.id }).where(eq(quests.id, q.id));
  }
  await rescoreRecent(1);
  revalidatePath("/");
}

export type IcpDecision = "qualified" | "killed";

/** One ICP decision = one icp_task_closed event = 1 boss damage. Attio write-back lands in Phase 3. */
export async function decideIcp(candidateId: string, decision: IcpDecision) {
  const user = await requireUser();
  const db = getDb();
  const [c] = await db
    .update(icpCandidates)
    .set({ decision, decidedAt: new Date(), decidedBy: user.id })
    .where(and(eq(icpCandidates.id, candidateId), isNull(icpCandidates.decision)))
    .returning();
  if (!c) return { ok: false as const };

  await db
    .insert(events)
    .values({
      userId: user.id,
      source: "attio",
      sourceId: `icp:${c.attioRecordId ?? c.id}`,
      type: "icp_task_closed",
      occurredAt: new Date(),
      payload: { decision, company: c.name, writtenToAttio: false, sample: c.attioRecordId?.startsWith("seed:") ?? false },
    })
    .onConflictDoNothing();
  await rescoreRecent(1);
  revalidatePath("/");
  revalidatePath("/review");
  return { ok: true as const };
}

export async function undoIcp(candidateId: string) {
  const user = await requireUser();
  const db = getDb();
  const [c] = await db
    .update(icpCandidates)
    .set({ decision: null, decidedAt: null, decidedBy: null })
    .where(and(eq(icpCandidates.id, candidateId), eq(icpCandidates.decidedBy, user.id)))
    .returning();
  if (!c) return;
  await db.delete(events).where(and(eq(events.source, "attio"), eq(events.sourceId, `icp:${c.attioRecordId ?? c.id}`)));
  await rescoreRecent(1);
  revalidatePath("/");
  revalidatePath("/review");
}

export async function askGameMaster(question: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const text = question.trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Empty message" };
  if (!gmConfigured()) return { ok: false, error: "The game master isn't connected: set ANTHROPIC_API_KEY." };

  const db = getDb();
  await db.insert(gmMessages).values({ userId: user.id, kind: "user", content: text });
  try {
    const [state, thread] = await Promise.all([loadGameState(user.id), loadThread(user.id)]);
    const turns = thread
      .filter((m) => m.kind !== "debrief")
      .map((m) => ({
        kind: m.kind === "user" ? ("user" as const) : ("gm" as const),
        text: m.title ? `${m.title}\n${m.content}` : m.content,
      }));
    const answer = await gmReply(state, turns, user.name);
    await db.insert(gmMessages).values({ userId: user.id, kind: "answer", content: answer });
    return { ok: true };
  } catch (e) {
    console.error("game master reply failed", e);
    return { ok: false, error: "The game master didn't answer. Try again in a moment." };
  } finally {
    revalidatePath("/");
  }
}
