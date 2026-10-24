import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { auth, allowedEmails } from "@/auth";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";
import { passwordMode, sessionEmail } from "./password-session";

// Three ways in, picked by env:
//   AUTH_GOOGLE_ID set  → Google sign-in (allowlist)
//   APP_PASSWORD set    → shared password + "who are you" (allowlist)
//   neither, in dev     → signed in as the first allowed email
// In production with neither, nobody gets in.

/** True only in local dev with no auth configured. */
export function devBypass(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.AUTH_GOOGLE_ID && !process.env.APP_PASSWORD;
}

export async function getCurrentUser(): Promise<User | null> {
  // Always request-time: otherwise a build without auth env vars prerenders pages as static redirects.
  await connection();
  let email: string | null | undefined;
  if (devBypass()) {
    email = allowedEmails()[0];
  } else if (passwordMode()) {
    email = await sessionEmail();
  } else if (process.env.AUTH_GOOGLE_ID) {
    const session = await auth();
    email = session?.user?.email?.toLowerCase();
  }
  if (!email || !allowedEmails().includes(email)) return null;
  const [user] = await getDb().select().from(schema.users).where(eq(schema.users.email, email));
  return user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
