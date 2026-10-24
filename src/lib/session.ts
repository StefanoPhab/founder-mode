import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, allowedEmails } from "@/auth";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";

/** True only in local dev without Google credentials: signs you in as the first allowed email. */
export function devBypass(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.AUTH_GOOGLE_ID;
}

export async function getCurrentUser(): Promise<User | null> {
  let email: string | undefined;
  if (devBypass()) {
    email = allowedEmails()[0];
  } else {
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
