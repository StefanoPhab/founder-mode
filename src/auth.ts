import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Requested up front so Phase 1–3 (Calendar ingestion, Gmail drafts, calendar holds)
// don't need a second consent screen. Nothing is ever sent: drafts and holds only.
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: { params: { scope: GOOGLE_SCOPES, access_type: "offline", prompt: "consent" } },
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = (profile?.email ?? user.email ?? "").toLowerCase();
      if (!email || !allowedEmails().includes(email) || profile?.email_verified === false) return false;
      const tokens = {
        googleAccessToken: account?.access_token ?? null,
        googleTokenExpiresAt: account?.expires_at ? new Date(account.expires_at * 1000) : null,
        // Google only returns a refresh token on consent; keep the old one otherwise.
        ...(account?.refresh_token ? { googleRefreshToken: account.refresh_token } : {}),
      };
      const name = user.name ?? email.split("@")[0];
      await getDb()
        .insert(schema.users)
        .values({ email, name, ...tokens })
        .onConflictDoUpdate({ target: schema.users.email, set: { name, ...tokens } });
      return true;
    },
    async jwt({ token }) {
      if (token.email && !token.uid) {
        const [u] = await getDb().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, token.email.toLowerCase()));
        if (u) token.uid = u.id;
      }
      return token;
    },
  },
});
