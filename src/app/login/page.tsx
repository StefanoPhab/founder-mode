import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/ui";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="card flex w-full max-w-sm flex-col gap-5 p-6">
        <Logo />
        <p className="text-sm text-muted">Private. Two founders, one game.</p>
        {error && (
          <p className="rounded-[10px] border border-boss/40 px-3 py-2 text-sm text-boss">
            {error === "AccessDenied" ? "That Google account isn't on the allowlist." : "Sign-in failed. Try again."}
          </p>
        )}
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
      </div>
    </main>
  );
}
