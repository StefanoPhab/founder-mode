import type { Tier } from "@/db/schema";

export const TIER_LABEL: Record<Tier, string> = {
  cash: "Cash",
  pipeline: "Pipeline",
  groundwork: "Groundwork",
  zero: "Zero",
};

export const TIER_TEXT: Record<Tier, string> = {
  cash: "text-cash",
  pipeline: "text-pipeline",
  groundwork: "text-groundwork",
  zero: "text-zero",
};

export const TIER_BG: Record<Tier, string> = {
  cash: "bg-cash",
  pipeline: "bg-pipeline",
  groundwork: "bg-groundwork",
  zero: "bg-zero",
};

const TIER_PILL: Record<Tier, string> = {
  cash: "bg-accent/15 text-cash",
  pipeline: "bg-pipeline/15 text-pipeline",
  groundwork: "bg-groundwork/15 text-groundwork",
  zero: "bg-white/5 text-zero",
};

export function TierPill({ tier }: { tier: Tier }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs ${TIER_PILL[tier]}`}>{TIER_LABEL[tier]}</span>;
}

export function Bar({ pct, className, height = "h-2" }: { pct: number; className: string; height?: string }) {
  return (
    <div className={`${height} overflow-hidden rounded bg-track`}>
      <div className={`${height} rounded ${className}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Sparkle({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-lg bg-accent text-base font-semibold text-accent-fg">E</div>
      <span className="text-base font-semibold">Eracolo</span>
      <span className="ml-1.5 font-mono text-[11px] tracking-[0.12em] text-muted">FOUNDER MODE</span>
    </div>
  );
}
