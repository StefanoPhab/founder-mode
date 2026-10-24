import Link from "next/link";
import type { ReactNode } from "react";
import type { Tier } from "@/db/schema";
import type { GameState } from "@/lib/game/state";
import type { ActivityItem } from "@/lib/gm/thread";
import { Icon, type IconName } from "./icons";
import { Bar, TIER_BG, TIER_LABEL, TIER_TEXT } from "./ui";

// The side overview: stacked cards of icon · label · value rows, same anatomy as
// the Eracolo app's overview panel.

const TIER_ICON: Record<Tier, IconName> = { cash: "euro", pipeline: "trend", groundwork: "layers", zero: "slash" };

function Card({ title, href, children }: { title: ReactNode; href?: string; children: ReactNode }) {
  const head = (
    <div className="flex items-center justify-between gap-2 pb-1">
      <h2 className="text-[15px] font-medium">{title}</h2>
      {href && <Icon name="chevron" size={16} className="text-muted" />}
    </div>
  );
  return (
    <section className="card flex flex-col gap-0.5 px-4 py-3.5">
      {href ? (
        <Link href={href} className="rounded-md hover:text-bright">
          {head}
        </Link>
      ) : (
        head
      )}
      {children}
    </section>
  );
}

function Row({
  icon,
  label,
  value,
  iconClass = "text-muted",
  valueClass = "text-muted",
  sub,
}: {
  icon: IconName | "dot";
  label: ReactNode;
  value?: ReactNode;
  iconClass?: string;
  valueClass?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="flex flex-col py-[5px]">
      <div className="flex items-center gap-3 text-sm">
        {icon === "dot" ? (
          <span className="flex size-[18px] flex-none items-center justify-center">
            <span className="size-[7px] rounded-full border border-muted" />
          </span>
        ) : (
          <Icon name={icon} className={iconClass} />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {value !== undefined && <span className={`flex-none font-mono text-[13px] ${valueClass}`}>{value}</span>}
      </div>
      {sub && <div className="pl-[30px] text-xs text-muted">{sub}</div>}
    </div>
  );
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function left(iso: string): string {
  const h = Math.round((new Date(iso).getTime() - Date.now()) / 3600e3);
  return h >= 1 ? `${h}h left` : "<1h left";
}

export function Overview({ s, activity }: { s: GameState; activity: ActivityItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Card title={`Level ${s.level}`}>
        <Row icon="star" label="XP" value={`${s.xpIntoLevel} / ${s.xpForNext}`} />
        <div className="pb-1.5 pl-[30px]">
          <Bar pct={(s.xpIntoLevel / s.xpForNext) * 100} className="bg-accent" height="h-1.5" />
        </div>
        <Row icon="zap" label="Today" value={`+${s.todayPoints}`} valueClass="text-bright" />
        <Row icon="flame" label="Streak" value={`${s.streak.current} ${s.streak.current === 1 ? "day" : "days"}`} />
        <Row icon="snowflake" label="Freezes this week" value={s.streak.freezesLeft} />
      </Card>

      {s.boss && (
        <Card title={`Boss · ${s.boss.name}`} href="/review">
          <Row icon="target" label="HP" value={`${s.boss.hp} / ${s.boss.maxHp}`} iconClass="text-boss" valueClass="text-boss" />
          <div className="pb-1.5 pl-[30px]">
            <Bar pct={(s.boss.hp / s.boss.maxHp) * 100} className="bg-boss" height="h-1.5" />
          </div>
          <Row icon="gift" label="Reward" value={`+${s.boss.rewardXp} XP`} />
        </Card>
      )}

      <Card title="This week">
        {s.tiers.map((t) => (
          <Row
            key={t.tier}
            icon={TIER_ICON[t.tier]}
            iconClass={TIER_TEXT[t.tier]}
            label={TIER_LABEL[t.tier]}
            value={t.points}
            valueClass={t.points > 0 ? TIER_TEXT[t.tier] : "text-muted"}
          />
        ))}
        <TierStrip tiers={s.tiers} />
        <Row icon="users" label="Co-op total" value={s.coopWeek} />
      </Card>

      <Card title="Modifiers">
        {s.modifiers.map((m) => (
          <Row
            key={m.id}
            icon="sliders"
            iconClass="text-bright"
            label={
              m.kind === "multiplier"
                ? `${TIER_LABEL[m.target as Tier] ?? m.target} ×${m.value}`
                : `${TIER_LABEL[m.target as Tier] ?? m.target} capped at ${m.value}`
            }
            value={left(m.endsAt)}
            sub={`${m.setBy === "ai" ? "Set by AI" : "Set by you"} · ${m.reason}`}
          />
        ))}
        <Row icon="slash" label="Tooling & planning" value="0 pts" />
        <Row icon="calendar" label="Sundays" value="frozen" />
      </Card>

      {s.loot.length > 0 && (
        <Card title="Loot">
          {s.loot.map((l) => (
            <Row
              key={l.id}
              icon={l.unlocked ? "gift" : "lock"}
              iconClass={l.unlocked ? "text-bright" : "text-muted"}
              label={l.name}
              value={l.status}
              valueClass={l.unlocked ? "text-bright" : "text-muted"}
            />
          ))}
        </Card>
      )}

      <Card title="Proof vault">
        {s.proofs.length === 0 ? (
          <Row icon="quote" label={<span className="text-muted">Client quotes and wins land here</span>} />
        ) : (
          s.proofs.map((p) => <Row key={p.id} icon="quote" label={p.text} />)
        )}
      </Card>

      <Card title="Activity">
        {activity.length === 0 ? (
          <Row icon="dot" label={<span className="text-muted">Nothing tracked yet</span>} />
        ) : (
          activity.map((a) => (
            <Row
              key={a.id}
              icon="dot"
              label={
                <>
                  {a.label}
                  {a.count > 1 && <span className="text-muted"> ×{a.count}</span>}
                  {a.points > 0 && <span className="text-muted"> · +{a.points}</span>}
                </>
              }
              value={ago(a.occurredAt)}
            />
          ))
        )}
      </Card>
    </div>
  );
}

/** One stacked bar: the week's points split by tier, so the cash share is visible at a glance. */
function TierStrip({ tiers }: { tiers: GameState["tiers"] }) {
  const total = tiers.reduce((s, t) => s + t.points, 0);
  if (total === 0) return null;
  return (
    <div className="flex h-1.5 gap-0.5 overflow-hidden rounded py-0 pl-[30px] my-1.5" aria-hidden="true">
      {tiers
        .filter((t) => t.points > 0)
        .map((t) => (
          <div key={t.tier} className={`h-1.5 rounded-sm ${TIER_BG[t.tier]}`} style={{ width: `${(t.points / total) * 100}%` }} />
        ))}
    </div>
  );
}
