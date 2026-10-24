"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { askGameMaster } from "@/app/actions";
import type { QuestView } from "@/lib/game/state";
import type { ThreadMessage } from "@/lib/gm/thread";
import { QuestCard } from "./quest-card";
import { Icon } from "./icons";
import { Sparkle } from "./ui";

const CHIPS = ["Reroll today's quests", "Why did I lose points this week?", "Plan next week's boss"];

const romeDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
const romeStamp = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", hour: "2-digit", minute: "2-digit" });
const romeTime = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });

export function Thread({
  messages,
  quests,
  today,
}: {
  messages: ThreadMessage[];
  quests: QuestView[];
  today: string;
}) {
  const [draft, setDraft] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef(false);

  // Quests hang under today's latest brief.
  const todaysBriefId = [...messages].reverse().find((m) => m.kind === "brief" && romeDay.format(new Date(m.createdAt)) === today)?.id;

  useEffect(() => {
    if (sentRef.current) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pendingText]);

  function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    sentRef.current = true;
    setDraft("");
    setError(null);
    setPendingText(q);
    startTransition(async () => {
      const r = await askGameMaster(q);
      if (!r.ok) setError(r.error);
      setPendingText(null);
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 pb-6 pt-4">
        {messages.length === 0 && !todaysBriefId && (
          <GmBlock eyebrow="Game master">
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.025em]">No brief yet today.</h1>
            <p className="text-base text-muted">The morning brief and 3 quests land at 07:45 on weekdays. Ask me anything meanwhile.</p>
          </GmBlock>
        )}

        {messages.map((m, i) => {
          const day = romeDay.format(new Date(m.createdAt));
          const prevDay = i > 0 ? romeDay.format(new Date(messages[i - 1].createdAt)) : null;
          const divider = day !== prevDay ? <DayDivider key={`d-${day}`} label={day === today ? "Today" : "Yesterday"} /> : null;
          return [divider, <Message key={m.id} m={m} quests={m.id === todaysBriefId ? quests : null} />];
        })}

        {pendingText && (
          <>
            <UserBubble text={pendingText} />
            <GmBlock eyebrow="Game master">
              <span className="flex items-center gap-2 text-sm text-muted">
                <span className="live-dot size-[7px] rounded-full bg-bright" /> Reading your numbers…
              </span>
            </GmBlock>
          </>
        )}
        {error && <p className="ml-[46px] text-sm text-boss">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 -mx-1 flex flex-col gap-2 bg-bg px-1 pb-4 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] sm:flex-wrap">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={pending}
              onClick={() => send(c)}
              className="min-h-8 flex-none cursor-pointer whitespace-nowrap rounded-lg border border-line px-2.5 text-[13px] text-muted hover:text-fg disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
        <div className="card flex gap-2 p-1.5">
          <label htmlFor="gm-ask" className="sr-only">
            Message the game master
          </label>
          <input
            id="gm-ask"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="I have 30 minutes. What's worth the most points?"
            autoComplete="off"
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] placeholder:text-zero focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={pending || !draft.trim()}
            className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] bg-accent text-accent-fg disabled:opacity-40"
          >
            <Icon name="send" />
          </button>
        </div>
      </form>
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-line" />
      <span className="eyebrow">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function GmBlock({ eyebrow, eyebrowClass = "", children }: { eyebrow: string; eyebrowClass?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="flex size-8 flex-none items-center justify-center rounded-[10px] border border-accent/40 bg-accent/15 text-bright">
        <Sparkle size={16} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
        <span className={`eyebrow ${eyebrowClass}`}>{eyebrow}</span>
        {children}
      </div>
    </div>
  );
}

function UserBubble({ text, at }: { text: string; at?: string }) {
  return (
    <div className="flex flex-col items-end gap-1 pl-12">
      <p className="card whitespace-pre-line rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-relaxed">{text}</p>
      {at && <span className="font-mono text-[11px] text-zero">{romeTime.format(new Date(at))}</span>}
    </div>
  );
}

function Message({ m, quests }: { m: ThreadMessage; quests: QuestView[] | null }) {
  const stamp = romeStamp.format(new Date(m.createdAt));
  switch (m.kind) {
    case "user":
      return <UserBubble text={m.content} at={m.createdAt} />;
    case "brief":
      return (
        <GmBlock eyebrow={`Game master · ${stamp}`}>
          <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[32px]">{m.title}</h1>
          <p className="text-base leading-relaxed text-muted">{m.content}</p>
          {quests && quests.length > 0 && (
            <div className="mt-2 flex flex-col gap-3">
              {quests.map((q, i) => (
                <QuestCard key={q.id} quest={q} defaultOpen={i === 0} />
              ))}
            </div>
          )}
        </GmBlock>
      );
    case "pattern":
      return (
        <GmBlock eyebrow="Pattern spotted" eyebrowClass="!text-groundwork">
          <p className="text-base font-medium">{m.title}</p>
          <p className="text-[15px] leading-relaxed text-muted">{m.content}</p>
        </GmBlock>
      );
    default:
      return (
        <GmBlock eyebrow={`Game master · ${romeTime.format(new Date(m.createdAt))}`}>
          {m.title && <p className="text-base font-medium">{m.title}</p>}
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{m.content}</p>
        </GmBlock>
      );
  }
}
