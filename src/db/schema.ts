import {
  pgTable,
  pgEnum,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const tierEnum = pgEnum("tier", ["cash", "pipeline", "groundwork", "zero"]);
export const sourceEnum = pgEnum("source", ["attio", "lgm", "gmail", "calendar", "manual"]);
export const modifierKindEnum = pgEnum("modifier_kind", ["multiplier", "cap"]);
export const setByEnum = pgEnum("set_by", ["ai", "user"]);
export const questStatusEnum = pgEnum("quest_status", ["open", "done", "skipped", "rerolled"]);
export const bossStatusEnum = pgEnum("boss_status", ["active", "defeated", "abandoned"]);
export const proofKindEnum = pgEnum("proof_kind", ["quote", "case", "conversion"]);
export const gmKindEnum = pgEnum("gm_kind", ["brief", "pattern", "answer", "user", "debrief"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  // Google tokens, stored so cron jobs can read Calendar/Gmail without the user present.
  googleRefreshToken: text("google_refresh_token"),
  googleAccessToken: text("google_access_token"),
  googleTokenExpiresAt: timestamp("google_token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rules = pgTable("rules", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull().unique(),
  label: text("label").notNull(),
  tier: tierEnum("tier").notNull(),
  basePoints: integer("base_points").notNull(),
  dailyCap: integer("daily_cap"),
  active: boolean("active").notNull().default(true),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    source: sourceEnum("source").notNull(),
    sourceId: text("source_id").notNull(),
    type: text("type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    // Filled by the scoring engine, never by the LLM.
    points: integer("points").notNull().default(0),
    tier: tierEnum("tier").notNull().default("zero"),
    ruleId: text("rule_id"),
    modifierIds: jsonb("modifier_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("events_source_source_id").on(t.source, t.sourceId),
    index("events_user_occurred").on(t.userId, t.occurredAt),
  ],
);

export const modifiers = pgTable("modifiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: modifierKindEnum("kind").notNull(),
  // A tier ("cash") or an event type ("positive_reply").
  target: text("target").notNull(),
  value: real("value").notNull(),
  reason: text("reason").notNull(),
  setBy: setByEnum("set_by").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuestPrep = {
  type: "gmail_draft" | "calendar_hold" | "icp_review" | "none";
  summary: string;
  draftLabel?: string;
  draft?: string;
  action?: { label: string; href?: string };
};

export const quests = pgTable(
  "quests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    date: date("date").notNull(),
    position: integer("position").notNull().default(0),
    title: text("title").notNull(),
    why: text("why").notNull(),
    tier: tierEnum("tier").notNull(),
    // The rule whose points this quest shows; points are always read from the rule.
    ruleEventType: text("rule_event_type").notNull(),
    // How many rule events complete the quest (e.g. 25 ICP decisions).
    targetCount: integer("target_count").notNull().default(1),
    source: sourceEnum("source").notNull(),
    status: questStatusEnum("status").notNull().default("open"),
    prep: jsonb("prep").$type<QuestPrep>().notNull(),
    completedByEventId: uuid("completed_by_event_id").references(() => events.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quests_user_date").on(t.userId, t.date)],
);

export const bosses = pgTable("bosses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  maxHp: integer("max_hp").notNull(),
  damageEventType: text("damage_event_type").notNull(),
  rewardXp: integer("reward_xp").notNull(),
  status: bossStatusEnum("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  defeatedAt: timestamp("defeated_at", { withTimezone: true }),
});

export type LootCondition =
  | { type: "level"; level: number }
  | { type: "streak"; days: number }
  | { type: "boss_defeated" }
  | { type: "cash_points_week"; points: number };

export const loot = pgTable("loot", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  unlockCondition: jsonb("unlock_condition").$type<LootCondition>().notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
});

export const proofItems = pgTable("proof_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: proofKindEnum("kind").notNull(),
  text: text("text").notNull(),
  sourceEventId: uuid("source_event_id").references(() => events.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const debriefs = pgTable(
  "debriefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    date: date("date").notNull(),
    moved: text("moved").notNull().default(""),
    blocked: text("blocked").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("debriefs_user_date").on(t.userId, t.date)],
);

export const gmMessages = pgTable("gm_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  kind: gmKindEnum("kind").notNull(),
  title: text("title").notNull().default(""),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// The Attio companies waiting for an ICP decision. Mirrors Attio from Phase 3;
// seeded by hand in Phase 0.
export const icpCandidates = pgTable("icp_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  attioRecordId: text("attio_record_id").unique(),
  name: text("name").notNull(),
  domain: text("domain").notNull().default(""),
  aiScore: integer("ai_score").notNull(),
  aiReasoning: text("ai_reasoning").notNull(),
  decision: text("decision"), // qualified | killed | null
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: uuid("decided_by").references(() => users.id),
});

export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Rule = typeof rules.$inferSelect;
export type Modifier = typeof modifiers.$inferSelect;
export type Quest = typeof quests.$inferSelect;
export type Boss = typeof bosses.$inferSelect;
export type Loot = typeof loot.$inferSelect;
export type ProofItem = typeof proofItems.$inferSelect;
export type GmMessage = typeof gmMessages.$inferSelect;
export type IcpCandidate = typeof icpCandidates.$inferSelect;
export type Tier = (typeof tierEnum.enumValues)[number];
export type Source = (typeof sourceEnum.enumValues)[number];

// One row per integration: when it last pulled and whether it failed.
export const syncState = pgTable("sync_state", {
  source: sourceEnum("source").primaryKey(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
});
