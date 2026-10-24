# Founder Mode

A private, AI-run game layer over Eracolo's real work tools. A game master reads what
actually happened (Attio, LGM, Gmail, Google Calendar), scores it with fixed rules, picks
3 quests a day and prepares the work. Two users, one workspace.

**Status: Phase 0 (skeleton).** All screens run on clearly labelled sample data
(`SAMPLE DATA` badge until the first real sync).

## The screen

- **Conversation is the main UI.** The thread with the game master: the morning brief opens
  the day with the 3 quest cards inside it, then patterns and your questions. The composer is
  pinned at the bottom, with chips for the common asks.
- **Overview on the side.** Same anatomy as the Eracolo app panel: Level, Boss, This week
  by tier, Modifiers, Loot, Proof vault, Activity. The grid button hides it on desktop and
  switches chat ↔ overview on phone.
- **`/review`** is the ICP rapid review: one company at a time, `Y` qualify · `N` kill ·
  `S` skip · `U` undo. Each decision = 1 boss damage.

## Principles in code

| Principle | Where |
|---|---|
| Points weighted by distance to cash; tooling/planning/this app = 0 | `src/lib/rules.config.ts` (seeded to `rules`) |
| Deterministic scoring, never the LLM | `src/lib/game/scoring.ts` (pure, unit-tested) |
| AI modifiers within fixed bounds (1.5× or 2×, one tier, ≤48h, one at a time, reason required) | `src/lib/game/modifiers.ts` |
| Manual logging is a capped fallback | `MANUAL_DAILY_CAP = 3`; only single-step quests can be checked by hand |
| Nothing outbound | Google scopes are draft/hold only (`gmail.compose`, `calendar.events`); no send code exists |

Level curve, streak (Sunday auto-freeze + 1 freeze/week) and boss HP are computed from
events in `src/lib/game/progress.ts` and `src/lib/game/state.ts`.

## Run locally

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL and ALLOWED_EMAILS at minimum
pnpm db:migrate
pnpm db:seed                  # rules + sample data; refuses if real events exist
pnpm dev
```

Without `AUTH_GOOGLE_ID` in dev you're signed in as the first allowed email. Without
`ANTHROPIC_API_KEY` the game master says it isn't connected; everything else works.

```bash
pnpm test        # scoring, caps, modifiers, level curve, streak, Rome day boundaries
pnpm typecheck
pnpm lint
pnpm db:seed --rules   # re-sync rules from rules.config.ts, keeps all data
```

## Deploy (Vercel)

1. Postgres on Neon or Supabase; put the pooled URL in `DATABASE_URL`.
2. Google Cloud → OAuth client (Web). Redirect URI `https://<domain>/api/auth/callback/google`.
   Consent screen **Internal** if both founders are on the same Google Workspace. In
   External + Testing mode Google expires refresh tokens after 7 days, which will break
   background Calendar/Gmail sync.
3. Set all env vars from `.env.example` on the Vercel project, then
   `pnpm db:migrate && pnpm db:seed` against the production DB.
4. `vercel.json` schedules `/api/cron/sync` every 15 min (authenticated by `CRON_SECRET`).

## Deviations from the spec (on purpose)

- **Conversation-first UI** with a side overview (per Stefano), instead of the one-column dashboard mock.
- **Ask the game master is wired early** (spec: Phase 4), read-only: it sees the game state and
  the thread, has no tools, and says so when asked to reroll or change anything.
- **No `streaks` table**: streaks are computed from events + quests, so they can't drift.
- **Added tables/columns**: `icp_candidates` (review queue, mirrors Attio from Phase 3),
  `sync_state` (last sync per source), `quests.rule_event_type` + `target_count` (quest points
  always come from the rule), `gm_messages.title` and kinds `user` / `debrief`.
- **No shadcn/ui yet**: the screen is a handful of custom components on Tailwind tokens.
- **Cache Components is off**: every screen is per-user and request-time.

## Next: Phase 1

Attio + Google Calendar sources behind `Source` (`src/lib/sources/types.ts`), wired into
`/api/cron/sync`, auto-completing quests from real events. Needs the open decisions below.

## Open decisions

1. Exact point values and caps (defaults in `rules.config.ts`).
2. How Attio marks a paying client vs a trial (list, stage or attribute).
3. Which LGM events count as a positive reply.
4. Whether the co-founder's work is tracked from the same sources.
