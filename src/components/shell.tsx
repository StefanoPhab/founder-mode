"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "./icons";
import { Logo } from "./ui";

const KEY = "fm.overview";

const noop = () => () => {};
function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) !== "closed";
  } catch {
    return true;
  }
}

/**
 * Conversation in the middle, overview on the side. Desktop: the grid button shows
 * or hides the side column. Phone: it switches between the chat and the overview.
 */
export function Shell({
  status,
  signOut,
  thread,
  overview,
}: {
  status: ReactNode;
  signOut: ReactNode;
  thread: ReactNode;
  overview: ReactNode;
}) {
  // Remembered per browser; the server always renders it open.
  const stored = useSyncExternalStore(noop, readStored, () => true);
  const [override, setOverride] = useState<boolean | null>(null);
  const desktopOpen = override ?? stored;
  const [mobileTab, setMobileTab] = useState<"chat" | "overview">("chat");

  function toggle() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      const next = !desktopOpen;
      setOverride(next);
      try {
        localStorage.setItem(KEY, next ? "open" : "closed");
      } catch {}
    } else {
      setMobileTab(mobileTab === "chat" ? "overview" : "chat");
    }
  }

  const active = mobileTab === "overview" ? "bg-surface text-fg" : desktopOpen ? "lg:bg-surface lg:text-fg" : "";

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1240px] flex-col px-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3.5">
        <Logo />
        <div className="flex items-center gap-1.5">
          <div className="mr-2 hidden items-center gap-3 sm:flex">{status}</div>
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle overview"
            title="Overview"
            className={`flex size-10 cursor-pointer items-center justify-center rounded-[10px] text-muted hover:text-fg ${active}`}
          >
            <Icon name="grid" size={20} />
          </button>
          {signOut}
        </div>
      </header>

      <div className={`grid flex-1 gap-8 ${desktopOpen ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <main className={`mx-auto w-full max-w-[760px] min-w-0 ${mobileTab === "overview" ? "hidden lg:block" : ""}`}>
          {thread}
        </main>
        <aside
          aria-label="Overview"
          className={`min-w-0 py-4 lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto ${mobileTab === "overview" ? "" : "hidden"} ${
            desktopOpen ? "lg:block" : "lg:hidden"
          }`}
        >
          <div className="mb-3 flex items-center gap-3 sm:hidden">{status}</div>
          {overview}
        </aside>
      </div>
    </div>
  );
}
