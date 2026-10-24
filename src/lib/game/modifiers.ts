import { MODIFIER_BOUNDS } from "../rules.config";

// Server-side guard for modifiers the game master proposes. The AI picks within
// these bounds; anything outside is rejected, never clamped silently.

export type ModifierRequest = {
  kind: "multiplier" | "cap";
  target: string;
  value: number;
  hours: number;
  reason: string;
};

const TIERS = ["cash", "pipeline", "groundwork"];

export function validateAiModifier(
  req: ModifierRequest,
  activeAiModifierCount: number,
): { ok: true } | { ok: false; error: string } {
  if (req.kind !== "multiplier") return { ok: false, error: "AI may only set multipliers" };
  if (!TIERS.includes(req.target)) return { ok: false, error: "Target must be one tier: cash, pipeline or groundwork" };
  if (!(MODIFIER_BOUNDS.allowedMultipliers as readonly number[]).includes(req.value)) {
    return { ok: false, error: `Multiplier must be one of ${MODIFIER_BOUNDS.allowedMultipliers.join(", ")}` };
  }
  if (!(req.hours > 0 && req.hours <= MODIFIER_BOUNDS.maxHours)) {
    return { ok: false, error: `Duration must be 1–${MODIFIER_BOUNDS.maxHours}h` };
  }
  if (!req.reason.trim()) return { ok: false, error: "A reason is required (it is shown in the UI)" };
  if (activeAiModifierCount >= MODIFIER_BOUNDS.maxActive) {
    return { ok: false, error: "Only one AI modifier may be active at a time" };
  }
  return { ok: true };
}
