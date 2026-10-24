/** Applies drizzle/ migrations. Runs on every Vercel build; a no-op when up to date. */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  // Neon's Vercel integration also sets an unpooled URL; DDL is safer off the pooler.
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set: skipping migrations");
    return;
  }
  const client = postgres(url, { max: 1 });
  await migrate(drizzle({ client }), { migrationsFolder: "drizzle" });
  await client.end();
  console.log("migrations applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
