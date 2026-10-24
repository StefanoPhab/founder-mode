import { asc, isNull, eq, and, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { dayKey, startOfDay } from "@/lib/time";
import { IcpReview } from "@/components/icp-review";

export default async function ReviewPage() {
  const user = await requireUser();
  const db = getDb();
  const since = startOfDay(dayKey(new Date()));
  const [queue, [today]] = await Promise.all([
    db.select().from(schema.icpCandidates).where(isNull(schema.icpCandidates.decision)).orderBy(asc(schema.icpCandidates.name)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.icpCandidates)
      .where(and(eq(schema.icpCandidates.decidedBy, user.id), gte(schema.icpCandidates.decidedAt, since))),
  ]);
  return (
    <IcpReview
      queue={queue.map((c) => ({ id: c.id, name: c.name, domain: c.domain, aiScore: c.aiScore, aiReasoning: c.aiReasoning }))}
      decidedToday={today?.n ?? 0}
    />
  );
}
