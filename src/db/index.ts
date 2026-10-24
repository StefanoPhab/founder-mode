import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { db?: Db };

/** Lazily connects, so importing this module never needs DATABASE_URL (e.g. at build time). */
export function getDb(): Db {
  if (!g.db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // prepare:false keeps it compatible with Supabase/Neon transaction poolers.
    g.db = drizzle({ client: postgres(url, { prepare: false, max: 5 }), schema });
  }
  return g.db;
}

export { schema };
