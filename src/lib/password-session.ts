import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Password gate used while Google sign-in is off: one shared APP_PASSWORD, and a
// cookie that names which founder you are, signed with AUTH_SECRET.

const COOKIE = "fm_session";
const MAX_AGE_S = 30 * 24 * 3600;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so lengths always match and timing doesn't leak length.
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMode(): boolean {
  return !process.env.AUTH_GOOGLE_ID && Boolean(process.env.APP_PASSWORD);
}

/** APP_PASSWORD as typed in the dashboard, minus stray whitespace or wrapping quotes. */
function expectedPassword(): string {
  return (process.env.APP_PASSWORD ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");
}

export function checkPassword(input: string): boolean {
  const expected = expectedPassword();
  return expected.length > 0 && safeEqual(input.trim(), expected);
}

export async function startSession(email: string): Promise<void> {
  const payload = `${Buffer.from(email).toString("base64url")}.${Math.floor(Date.now() / 1000) + MAX_AGE_S}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in email, or null if the cookie is missing, tampered with or expired. */
export async function sessionEmail(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [email64, exp, sig] = raw.split(".");
  if (!email64 || !exp || !sig) return null;
  if (!safeEqual(sig, sign(`${email64}.${exp}`))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return Buffer.from(email64, "base64url").toString();
}
