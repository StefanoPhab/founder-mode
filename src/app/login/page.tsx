import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { signIn, allowedEmails } from "@/auth";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { checkPassword, passwordMode, startSession } from "@/lib/password-session";
import { Logo } from "@/components/ui";

async function passwordSignIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!passwordMode()) redirect("/login?error=not-configured");
  if (!process.env.AUTH_SECRET) redirect("/login?error=no-secret");
  if (!allowedEmails().includes(email)) redirect("/login?error=email");
  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    redirect("/login?error=password");
  }
  try {
    // The user row may not exist yet if the DB was seeded before this email was allowed.
    const [existing] = await getDb().select().from(schema.users).where(eq(schema.users.email, email));
    if (!existing) await getDb().insert(schema.users).values({ email, name: email.split("@")[0] });
  } catch (e) {
    console.error("login: database unavailable", e);
    redirect("/login?error=db");
  }
  await startSession(email);
  redirect("/");
}

const ERRORS: Record<string, string> = {
  password: "Wrong password.",
  email: "Pick one of the founders above.",
  "not-configured": "APP_PASSWORD isn't set on the server. Add it on Vercel, then redeploy.",
  "no-secret": "AUTH_SECRET isn't set on the server. Add it on Vercel, then redeploy.",
  db: "The password is right, but the database isn't reachable. Connect Neon on Vercel, then redeploy.",
  AccessDenied: "That Google account isn't on the allowlist.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  const google = Boolean(process.env.AUTH_GOOGLE_ID);
  const emails = allowedEmails();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="card flex w-full max-w-sm flex-col gap-5 p-6">
        <Logo />
        <p className="text-sm text-muted">Private. Two founders, one game.</p>
        {typeof error === "string" && (
          <p className="rounded-[10px] border border-boss/40 px-3 py-2 text-sm text-boss">{ERRORS[error] ?? "Sign-in failed. Try again."}</p>
        )}
        {google ? (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button type="submit" className="h-11 w-full cursor-pointer rounded-[10px] bg-accent text-sm font-medium text-accent-fg hover:brightness-110">
              Continue with Google
            </button>
          </form>
        ) : passwordMode() ? (
          <form action={passwordSignIn} className="flex flex-col gap-3">
            {emails.length === 0 && (
              <p className="text-sm text-boss">ALLOWED_EMAILS is empty on the server. Add it on Vercel, then redeploy.</p>
            )}
            <fieldset className="flex flex-col gap-2">
              <legend className="eyebrow mb-2">Who are you</legend>
              {emails.map((e, i) => (
                <label key={e} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border border-line px-3 text-sm has-[:checked]:border-accent">
                  <input type="radio" name="email" value={e} defaultChecked={i === 0} className="accent-[oklch(0.62_0.16_150)]" />
                  {e}
                </label>
              ))}
            </fieldset>
            <label htmlFor="password" className="eyebrow mt-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-11 rounded-[10px] border border-line bg-bg px-3 text-[15px] focus:border-white/30 focus:outline-none"
            />
            <button type="submit" className="mt-1 h-11 cursor-pointer rounded-[10px] bg-accent text-sm font-medium text-accent-fg hover:brightness-110">
              Enter
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">
            Sign-in isn&apos;t configured: APP_PASSWORD is missing on the server. Add it on Vercel, then redeploy.
          </p>
        )}
      </div>
    </main>
  );
}
