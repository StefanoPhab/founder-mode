import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { GameState } from "@/lib/game/state";
import { RULES } from "@/lib/rules.config";

// The game master's conversational reply. Read-only in this version: it can see the
// game state and the thread, but has no tools, so it can't change quests, points or
// modifiers (those arrive with the morning job and set_modifier in Phases 2 and 4).

const MODEL = process.env.GM_MODEL ?? "claude-sonnet-5-5";

const SYSTEM = `You are the game master of Founder Mode, a private game layer over the real work of Eracolo's two founders (competitive price monitoring and dynamic pricing for e-commerce).

How the game works:
- Points come only from fixed rules, weighted by distance to cash. You never invent or promise points; quote the rules below.
- Planning, tooling and work on this app always score 0.
- Every weekday the founder gets 3 quests; at least one is Cash or Pipeline.

Rules (event → tier, points, daily cap):
${RULES.map((r) => `- ${r.label}: ${r.tier}, ${r.basePoints} pts${r.dailyCap ? `, cap ${r.dailyCap}/day` : ""}`).join("\n")}

What you can do right now: read the game state given to you and talk. You cannot reroll quests, set modifiers, create drafts or touch any tool yet. If asked to, say what you would change and that this lands in a later phase. Never claim an action was done.

Style: short and direct, like a coach who has read the numbers. 2–5 sentences unless asked for more. Ground every claim in the state below; if data is missing, say so instead of guessing. Answer in the language the founder writes in. Client-facing drafts are in Italian, informal "tu", no AI-sounding phrasing.`;

export type ThreadTurn = { kind: "user" | "gm"; text: string };

function stateBrief(s: GameState): string {
  return JSON.stringify({
    today: s.today,
    sampleData: s.lastSync === null,
    level: s.level,
    xp: `${s.xpIntoLevel}/${s.xpForNext}`,
    todayPoints: s.todayPoints,
    streak: s.streak,
    thisWeekByTier: Object.fromEntries(s.tiers.map((t) => [t.tier, { points: t.points, events: t.count }])),
    coopWeek: s.coopWeek,
    boss: s.boss && { name: s.boss.name, hp: s.boss.hp, maxHp: s.boss.maxHp },
    activeModifiers: s.modifiers.map((m) => ({ kind: m.kind, target: m.target, value: m.value, reason: m.reason, endsAt: m.endsAt })),
    quests: s.quests.map((q) => ({ title: q.title, tier: q.tier, points: q.points, done: q.done, progress: `${q.progress}/${q.targetCount}` })),
    loot: s.loot.map((l) => ({ name: l.name, status: l.status })),
  });
}

export function gmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function gmReply(state: GameState, thread: ThreadTurn[], founderName: string): Promise<string> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const t of thread) {
    const role = t.kind === "user" ? "user" : "assistant";
    const last = messages[messages.length - 1];
    // The thread opens with game-master messages (brief, pattern); the API needs a user turn first.
    if (!last && role === "assistant") messages.push({ role: "user", content: "(opened the app)" });
    messages.push({ role, content: t.text });
  }

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: `Founder: ${founderName}\nGame state now:\n${stateBrief(state)}` },
    ],
    messages,
  });

  if (response.stop_reason === "refusal") return "I can't answer that one.";
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "I don't have an answer for that yet.";
}
