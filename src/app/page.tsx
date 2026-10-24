import { requireUser, devBypass } from "@/lib/session";
import { loadGameState } from "@/lib/game/state";
import { loadActivity, loadThread } from "@/lib/gm/thread";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { endSession, passwordMode } from "@/lib/password-session";
import { Shell } from "@/components/shell";
import { Thread } from "@/components/thread";
import { Overview } from "@/components/overview";
import { Icon } from "@/components/icons";

const romeTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });

export default async function Home() {
  const user = await requireUser();
  const [s, messages, activity] = await Promise.all([loadGameState(user.id), loadThread(user.id), loadActivity(user.id)]);

  const status = (
    <>
      <span className="flex items-center gap-2">
        <span className="live-dot size-[7px] rounded-full bg-bright" />
        <span className="font-mono text-[11px] text-muted">ATTIO · LGM · GMAIL · CALENDAR</span>
      </span>
      {s.lastSync ? (
        <span className="font-mono text-[11px] text-muted">SYNCED {romeTime.format(new Date(s.lastSync))}</span>
      ) : (
        <span className="rounded-md border border-groundwork/50 px-2 py-[3px] font-mono text-[11px] tracking-[0.08em] text-groundwork">
          SAMPLE DATA
        </span>
      )}
    </>
  );

  const signOutButton = devBypass() ? null : (
    <form
      action={async () => {
        "use server";
        if (passwordMode()) {
          await endSession();
          redirect("/login");
        }
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        aria-label={`Sign out ${user.name}`}
        title={`Sign out ${user.name}`}
        className="flex size-10 cursor-pointer items-center justify-center rounded-[10px] text-muted hover:text-fg"
      >
        <Icon name="logout" size={20} />
      </button>
    </form>
  );

  return (
    <Shell
      status={status}
      signOut={signOutButton}
      thread={<Thread messages={messages} quests={s.quests} today={s.today} />}
      overview={<Overview s={s} activity={activity} />}
    />
  );
}
