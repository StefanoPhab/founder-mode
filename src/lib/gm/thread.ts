import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays, dayKey, startOfDay } from "@/lib/time";

export type ThreadMessage = {
  id: string;
  kind: "brief" | "pattern" | "answer" | "user" | "debrief";
  title: string;
  content: string;
  createdAt: string;
};

/** Today's and yesterday's conversation, oldest first. */
export async function loadThread(userId: string, now = new Date()): Promise<ThreadMessage[]> {
  const since = startOfDay(addDays(dayKey(now), -1));
  const rows = await getDb()
    .select()
    .from(schema.gmMessages)
    .where(and(eq(schema.gmMessages.userId, userId), gte(schema.gmMessages.createdAt, since)))
    .orderBy(desc(schema.gmMessages.createdAt))
    .limit(60);
  return rows.reverse().map((m) => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
}

export type ActivityItem = { id: string; label: string; count: number; points: number; occurredAt: string };

/** Latest events for the overview's activity card; runs of the same event type collapse into one row. */
export async function loadActivity(userId: string, limit = 6): Promise<ActivityItem[]> {
  const db = getDb();
  const [rows, rules] = await Promise.all([
    db.select().from(schema.events).where(eq(schema.events.userId, userId)).orderBy(desc(schema.events.occurredAt)).limit(200),
    db.select().from(schema.rules),
  ]);
  const label = new Map(rules.map((r) => [r.eventType, r.label]));
  const out: ActivityItem[] = [];
  let lastType = "";
  for (const e of rows) {
    const last = out[out.length - 1];
    if (last && lastType === e.type) {
      last.count++;
      last.points += e.points;
      continue;
    }
    if (out.length === limit) break;
    lastType = e.type;
    out.push({ id: e.id, label: label.get(e.type) ?? e.type, count: 1, points: e.points, occurredAt: e.occurredAt.toISOString() });
  }
  return out;
}
