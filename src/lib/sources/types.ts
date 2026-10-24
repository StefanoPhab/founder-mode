import type { Source as SourceName } from "@/db/schema";

// Every integration sits behind this interface. Pull is idempotent: events are
// upserted on (source, source_id), so overlapping windows are harmless.
export type NormalizedEvent = {
  userEmail: string;
  sourceId: string;
  type: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
};

export interface Source {
  id: Exclude<SourceName, "manual">;
  pull(since: Date): Promise<NormalizedEvent[]>;
}
