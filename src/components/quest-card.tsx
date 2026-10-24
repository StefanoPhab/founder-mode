"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toggleQuest } from "@/app/actions";
import type { QuestView } from "@/lib/game/state";
import { Sparkle, TierPill, TIER_TEXT } from "./ui";

const SOURCE_LABEL: Record<string, string> = {
  attio: "Attio",
  lgm: "LGM",
  gmail: "Gmail",
  calendar: "Calendar",
  manual: "manual",
};

export function QuestCard({ quest, defaultOpen = false }: { quest: QuestView; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(quest.done);
  const multiStep = quest.targetCount > 1;

  function onToggle() {
    startTransition(async () => {
      setDone(!done);
      await toggleQuest(quest.id);
    });
  }

  async function copyDraft() {
    if (!quest.prep.draft) return;
    try {
      await navigator.clipboard.writeText(quest.prep.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setOpen(true);
    }
  }

  const action = quest.prep.action;
  const primaryClass =
    "inline-flex h-9 items-center rounded-[10px] bg-accent px-3 text-[13px] font-medium text-accent-fg hover:brightness-110";

  return (
    <article className={`card overflow-hidden ${done ? "!border-accent/50" : ""}`}>
      <div className="flex items-start gap-3.5 px-[18px] py-4">
        {multiStep ? (
          <div
            className={`flex size-11 flex-none flex-col items-center justify-center rounded-[10px] border font-mono text-[11px] leading-tight ${
              done ? "border-accent bg-accent text-accent-fg" : "border-white/20 text-muted"
            }`}
            title="Auto-tracked: completes from real events"
          >
            <span>{quest.progress}</span>
            <span className="opacity-70">/{quest.targetCount}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            disabled={pending}
            aria-pressed={done}
            aria-label={done ? "Mark quest not done" : "Mark quest done"}
            className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border ${
              done ? "border-accent bg-accent" : "border-white/20 hover:border-white/40"
            }`}
          >
            {done && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent-fg">
                <path d="M5 12l5 5 9-10" />
              </svg>
            )}
          </button>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap justify-between gap-2">
            <h3 className={`text-base font-medium ${done ? "line-through decoration-muted" : ""}`}>{quest.title}</h3>
            <span className={`font-mono text-[15px] ${TIER_TEXT[quest.tier]}`}>
              +{quest.points}
              {quest.multiplier ? ` · ×${quest.multiplier}` : ""}
            </span>
          </div>
          <p className="text-sm text-muted">{quest.why}</p>
          <div className="flex flex-wrap items-center gap-2">
            <TierPill tier={quest.tier} />
            <span className="font-mono text-[11px] text-muted">
              {quest.manual ? "marked by hand" : "auto-tracked"} · {SOURCE_LABEL[quest.source] ?? quest.source}
            </span>
          </div>
        </div>
      </div>

      {quest.prep.type !== "none" && (
        <div className="flex flex-col gap-2.5 border-t border-line bg-accent/5 px-[18px] py-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkle size={14} className="flex-none text-bright" />
              <span className="text-[13px]">{quest.prep.summary}</span>
            </div>
            <div className="flex gap-2">
              {quest.prep.draft && (
                <button
                  type="button"
                  onClick={() => setOpen(!open)}
                  aria-expanded={open}
                  className="h-9 cursor-pointer rounded-[10px] border border-white/15 px-3 text-[13px] hover:border-white/30"
                >
                  {open ? "Hide" : "Review"}
                </button>
              )}
              {action?.href ? (
                <Link href={action.href} className={primaryClass}>
                  {action.label}
                </Link>
              ) : quest.prep.draft ? (
                <button type="button" onClick={copyDraft} className={`${primaryClass} cursor-pointer`}>
                  {copied ? "Copied" : quest.prep.type === "calendar_hold" ? "Copy slots" : "Copy draft"}
                </button>
              ) : null}
            </div>
          </div>
          {open && quest.prep.draft && (
            <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-bg px-3.5 py-3">
              <span className="font-mono text-[11px] text-muted">{quest.prep.draftLabel}</span>
              <p className="whitespace-pre-line text-sm leading-relaxed">{quest.prep.draft}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
