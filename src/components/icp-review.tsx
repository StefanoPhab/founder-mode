"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { decideIcp, undoIcp, type IcpDecision } from "@/app/actions";
import { Icon } from "./icons";

type Candidate = { id: string; name: string; domain: string; aiScore: number; aiReasoning: string };

/** Full-screen rapid review: Y qualify · N kill · S skip · U undo. One decision = 1 boss damage. */
export function IcpReview({ queue: initial, decidedToday }: { queue: Candidate[]; decidedToday: number }) {
  const [queue, setQueue] = useState(initial);
  const [history, setHistory] = useState<{ c: Candidate; d: IcpDecision | "skip" }[]>([]);
  const [count, setCount] = useState(decidedToday);
  const [flash, setFlash] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const current = queue[0];

  const act = useCallback(
    (d: IcpDecision | "skip") => {
      if (!current) return;
      setQueue((q) => (d === "skip" ? [...q.slice(1), q[0]] : q.slice(1)));
      setHistory((h) => [...h, { c: current, d }]);
      if (d === "skip") return;
      setCount((n) => n + 1);
      setFlash(d === "qualified" ? "Qualified · 1 damage" : "Killed · 1 damage");
      startTransition(async () => {
        const r = await decideIcp(current.id, d);
        if (!r.ok) setFlash("Already decided by your co-founder");
      });
    },
    [current],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setQueue((q) => [last.c, ...q.filter((c) => c.id !== last.c.id)]);
    if (last.d === "skip") return;
    setCount((n) => Math.max(0, n - 1));
    setFlash("Undone");
    startTransition(async () => {
      await undoIcp(last.c.id);
    });
  }, [history]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "y") act("qualified");
      else if (k === "n") act("killed");
      else if (k === "s") act("skip");
      else if (k === "u") undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, undo]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(t);
  }, [flash]);

  const scoreClass = (s: number) => (s >= 75 ? "text-bright" : s >= 50 ? "text-groundwork" : "text-boss");

  return (
    <div className="flex min-h-dvh flex-col px-4">
      <header className="mx-auto flex w-full max-w-[760px] items-center justify-between border-b border-line py-3.5">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted hover:text-fg">
          <Icon name="chevron" size={16} className="rotate-180" /> Back to the game
        </Link>
        <span className="font-mono text-[11px] text-muted">
          {count} DAMAGE TODAY · {queue.length} LEFT
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center gap-6 py-10">
        {current ? (
          <>
            <div className="flex flex-col gap-3">
              <span className="eyebrow">ICP rapid review</span>
              <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.025em] sm:text-[40px]">{current.name}</h1>
              <p className="font-mono text-[13px] text-muted">{current.domain}</p>
            </div>
            <div className="card flex flex-col gap-2 px-5 py-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="eyebrow">AI score</span>
                <span className={`font-mono text-2xl ${scoreClass(current.aiScore)}`}>{current.aiScore}</span>
              </div>
              <p className="text-[15px] leading-relaxed">{current.aiReasoning}</p>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <KeyButton k="Y" label="Qualify" onClick={() => act("qualified")} primary />
              <KeyButton k="N" label="Kill" onClick={() => act("killed")} />
              <KeyButton k="S" label="Skip" onClick={() => act("skip")} />
            </div>
            <p className="text-center font-mono text-[11px] text-zero">U to undo · Attio write-back arrives in Phase 3</p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="eyebrow">Backlog clear</span>
            <h1 className="text-[32px] font-semibold tracking-[-0.025em]">Nothing left to review.</h1>
            <Link href="/" className="text-bright hover:underline">
              Back to the game
            </Link>
          </div>
        )}
        <p aria-live="polite" className={`h-5 text-center text-sm text-bright transition-opacity ${flash ? "opacity-100" : "opacity-0"}`}>
          {flash}
        </p>
      </main>
    </div>
  );
}

function KeyButton({ k, label, onClick, primary }: { k: string; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 cursor-pointer items-center justify-center gap-2.5 rounded-xl text-[15px] font-medium ${
        primary ? "bg-accent text-accent-fg hover:brightness-110" : "border border-white/15 hover:border-white/30"
      }`}
    >
      <kbd className={`rounded-md border px-1.5 font-mono text-xs ${primary ? "border-accent-fg/30" : "border-white/20 text-muted"}`}>{k}</kbd>
      {label}
    </button>
  );
}
