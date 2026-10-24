import type { Tier } from "@/db/schema";

// Default scoring rules. Seeded into the `rules` table; the DB copy is what scoring reads.
// Points are weighted by distance to cash. Values are a starting point (spec §10: to confirm).
export type RuleConfig = {
  id: string;
  eventType: string;
  label: string;
  tier: Tier;
  basePoints: number;
  dailyCap: number | null; // max scoring events per day for this rule
};

export const RULES: RuleConfig[] = [
  // Cash
  { id: "cash.client_meeting", eventType: "client_meeting_held", label: "Meeting held with a paying client", tier: "cash", basePoints: 40, dailyCap: null },
  { id: "cash.trial_converted", eventType: "trial_converted", label: "Trial converted to paid", tier: "cash", basePoints: 200, dailyCap: null },
  { id: "cash.client_why", eventType: "client_why_logged", label: "Client explains why they pay", tier: "cash", basePoints: 50, dailyCap: null },
  // Pipeline
  { id: "pipeline.positive_reply", eventType: "positive_reply", label: "Positive reply on outbound", tier: "pipeline", basePoints: 15, dailyCap: null },
  { id: "pipeline.meeting_booked", eventType: "prospect_meeting_booked", label: "Demo/meeting booked with prospect", tier: "pipeline", basePoints: 30, dailyCap: null },
  { id: "pipeline.proof_asset", eventType: "proof_asset_created", label: "Proof asset created", tier: "pipeline", basePoints: 20, dailyCap: 2 },
  // Groundwork
  { id: "groundwork.icp_closed", eventType: "icp_task_closed", label: "ICP task closed (qualified or killed)", tier: "groundwork", basePoints: 1, dailyCap: 50 },
  { id: "groundwork.outbound_step", eventType: "outbound_step_sent", label: "Outbound step sent", tier: "groundwork", basePoints: 1, dailyCap: 30 },
  // Zero: planning, tooling and work on this app.
  { id: "zero.tooling", eventType: "tooling", label: "Tooling / planning / this app", tier: "zero", basePoints: 0, dailyCap: null },
];

// Manual logging is a fallback: at most this many manual events score per user per day.
export const MANUAL_DAILY_CAP = 3;

// Bounds the server enforces on AI-set modifiers.
export const MODIFIER_BOUNDS = {
  allowedMultipliers: [1.5, 2] as const,
  maxHours: 48,
  maxActive: 1,
} as const;

// Payload tags that force an event to the Zero tier regardless of its type.
export const ZERO_TAGS = ["tooling", "planning", "founder-mode"];

export const TIMEZONE = "Europe/Rome";
