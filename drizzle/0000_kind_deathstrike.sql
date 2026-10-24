CREATE TYPE "public"."boss_status" AS ENUM('active', 'defeated', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."gm_kind" AS ENUM('brief', 'pattern', 'answer', 'user', 'debrief');--> statement-breakpoint
CREATE TYPE "public"."modifier_kind" AS ENUM('multiplier', 'cap');--> statement-breakpoint
CREATE TYPE "public"."proof_kind" AS ENUM('quote', 'case', 'conversion');--> statement-breakpoint
CREATE TYPE "public"."quest_status" AS ENUM('open', 'done', 'skipped', 'rerolled');--> statement-breakpoint
CREATE TYPE "public"."set_by" AS ENUM('ai', 'user');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('attio', 'lgm', 'gmail', 'calendar', 'manual');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('cash', 'pipeline', 'groundwork', 'zero');--> statement-breakpoint
CREATE TABLE "bosses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"max_hp" integer NOT NULL,
	"damage_event_type" text NOT NULL,
	"reward_xp" integer NOT NULL,
	"status" "boss_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"defeated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "debriefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"moved" text DEFAULT '' NOT NULL,
	"blocked" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "source" NOT NULL,
	"source_id" text NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"tier" "tier" DEFAULT 'zero' NOT NULL,
	"rule_id" text,
	"modifier_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gm_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "gm_kind" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icp_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attio_record_id" text,
	"name" text NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"ai_score" integer NOT NULL,
	"ai_reasoning" text NOT NULL,
	"decision" text,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	CONSTRAINT "icp_candidates_attio_record_id_unique" UNIQUE("attio_record_id")
);
--> statement-breakpoint
CREATE TABLE "loot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unlock_condition" jsonb NOT NULL,
	"unlocked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "modifier_kind" NOT NULL,
	"target" text NOT NULL,
	"value" real NOT NULL,
	"reason" text NOT NULL,
	"set_by" "set_by" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proof_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "proof_kind" NOT NULL,
	"text" text NOT NULL,
	"source_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"why" text NOT NULL,
	"tier" "tier" NOT NULL,
	"rule_event_type" text NOT NULL,
	"target_count" integer DEFAULT 1 NOT NULL,
	"source" "source" NOT NULL,
	"status" "quest_status" DEFAULT 'open' NOT NULL,
	"prep" jsonb NOT NULL,
	"completed_by_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"label" text NOT NULL,
	"tier" "tier" NOT NULL,
	"base_points" integer NOT NULL,
	"daily_cap" integer,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "rules_event_type_unique" UNIQUE("event_type")
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"source" "source" PRIMARY KEY NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"google_refresh_token" text,
	"google_access_token" text,
	"google_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "debriefs" ADD CONSTRAINT "debriefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gm_messages" ADD CONSTRAINT "gm_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icp_candidates" ADD CONSTRAINT "icp_candidates_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot" ADD CONSTRAINT "loot_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_items" ADD CONSTRAINT "proof_items_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_completed_by_event_id_events_id_fk" FOREIGN KEY ("completed_by_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "debriefs_user_date" ON "debriefs" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "events_source_source_id" ON "events" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "events_user_occurred" ON "events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "quests_user_date" ON "quests" USING btree ("user_id","date");