/**
 * Phase 0 seed: rules from rules.config.ts plus clearly-labelled sample data so the
 * whole screen renders. Dates are relative to now, so the dashboard always looks live.
 *
 *   pnpm db:seed           # rules + sample data (refuses if real events exist)
 *   pnpm db:seed --rules   # rules only; safe at any time
 *   pnpm db:seed --force   # wipe game tables and reseed, even over real events
 */
import "dotenv/config";
import { sql, not, like } from "drizzle-orm";
import { getDb, schema } from "./index";
import { RULES } from "../lib/rules.config";
import { scoreEvents } from "../lib/game/scoring";
import { addDays, dayKey, isSunday, startOfDay } from "../lib/time";

const db = getDb();
const args = new Set(process.argv.slice(2));

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** hh:mm Europe/Rome on a given day. */
function at(day: string, hour: number, minute = 0): Date {
  return new Date(startOfDay(day).getTime() + (hour * 60 + minute) * 60e3);
}

async function seedRules() {
  for (const r of RULES) {
    await db
      .insert(schema.rules)
      .values({ ...r, active: true })
      .onConflictDoUpdate({
        target: schema.rules.id,
        set: { eventType: r.eventType, label: r.label, tier: r.tier, basePoints: r.basePoints, dailyCap: r.dailyCap },
      });
  }
  console.log(`rules: ${RULES.length}`);
}

async function seedUsers() {
  const emails = (process.env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) throw new Error("Set ALLOWED_EMAILS (comma-separated) before seeding");
  const roles = ["sales", "product"];
  const out = [];
  for (const [i, email] of emails.entries()) {
    const [u] = await db
      .insert(schema.users)
      .values({ email, name: email.split("@")[0], role: roles[i] ?? "" })
      .onConflictDoUpdate({ target: schema.users.email, set: { email } })
      .returning();
    out.push(u);
  }
  console.log(`users: ${out.map((u) => u.email).join(", ")}`);
  return out;
}

async function wipeGameTables() {
  await db.execute(sql`truncate table quests, events, modifiers, bosses, loot, proof_items, debriefs, gm_messages, icp_candidates, sync_state restart identity cascade`);
}

async function seedSample(users: (typeof schema.users.$inferSelect)[]) {
  const now = new Date();
  const today = dayKey(now);
  const rand = rng(42);
  const [me, partner] = users;

  // Modifier: the game master doubled Cash yesterday evening because Cash stalled.
  const [cashX2] = await db
    .insert(schema.modifiers)
    .values({
      kind: "multiplier",
      target: "cash",
      value: 2,
      reason: "Cash hasn't moved in 4 days",
      setBy: "ai",
      startsAt: new Date(now.getTime() - 2 * 3600e3),
      endsAt: new Date(now.getTime() + 46 * 3600e3),
    })
    .returning();

  const bossStart = new Date(`${addDays(today, -6)}T00:00:00Z`);
  await db.insert(schema.bosses).values({
    name: "ICP backlog",
    description: "AI pre-scores, you confirm. 1 decision = 1 damage.",
    maxHp: 580,
    damageEventType: "icp_task_closed",
    rewardXp: 300,
    startedAt: bossStart,
  });

  // ~3 weeks of plausible activity. No Cash events in the last 4 days (that's the story).
  type NewEvent = typeof schema.events.$inferInsert & { id: string };
  const evs: NewEvent[] = [];
  let n = 0;
  const push = (userId: string, source: NewEvent["source"], type: string, occurredAt: Date, payload: Record<string, unknown> = {}) =>
    evs.push({ id: crypto.randomUUID(), userId, source, sourceId: `seed:${n++}`, type, occurredAt, payload: { ...payload, sample: true } });

  for (let back = 21; back >= 0; back--) {
    const day = addDays(today, -back);
    if (isSunday(day)) continue;
    const isToday = back === 0;
    const icp = isToday ? 0 : Math.floor(15 + rand() * 30);
    for (let i = 0; i < icp; i++) push(me.id, "attio", "icp_task_closed", at(day, 9 + (i % 8), i % 60));
    const steps = isToday ? 3 : Math.floor(10 + rand() * 25);
    for (let i = 0; i < steps; i++) push(me.id, "lgm", "outbound_step_sent", at(day, 8, i % 60));
    if (!isToday && rand() < 0.7) push(me.id, "lgm", "positive_reply", at(day, 14, 10));
    if (!isToday && rand() < 0.3) push(me.id, "calendar", "prospect_meeting_booked", at(day, 16));
    if (back >= 5 && back % 4 === 1) push(me.id, "calendar", "client_meeting_held", at(day, 11));
    if (back % 6 === 2) push(me.id, "manual", "tooling", at(day, 18), { tags: ["founder-mode"] });
    if (partner && !isToday) {
      if (rand() < 0.5) push(partner.id, "attio", "proof_asset_created", at(day, 15));
      if (rand() < 0.4) push(partner.id, "lgm", "positive_reply", at(day, 12));
    }
  }
  push(me.id, "attio", "trial_converted", at(addDays(today, -12), 17), { company: "[CLIENT A]" });
  push(me.id, "gmail", "client_why_logged", at(addDays(today, -9), 10), { company: "[CLIENT A]" });

  const rules = await db.select().from(schema.rules);
  const scores = scoreEvents(
    evs.map((e) => ({ ...e, payload: e.payload ?? {} })),
    rules,
    [cashX2],
  );
  const rows = evs.map((e) => ({ ...e, ...scores.get(e.id)! }));
  for (let i = 0; i < rows.length; i += 500) await db.insert(schema.events).values(rows.slice(i, i + 500));
  console.log(`events: ${rows.length}`);

  const whyEvent = rows.find((r) => r.type === "client_why_logged")!;
  await db.insert(schema.proofItems).values([
    { kind: "quote", text: "Client quote: “[WHY THEY PAY]”", sourceEventId: whyEvent.id },
    { kind: "case", text: "~45% price gap on a matched SKU" },
  ]);

  for (const u of users) {
    await db.insert(schema.quests).values([
      {
        userId: u.id,
        date: today,
        position: 0,
        title: "Ask one paying client why they pay you",
        why: "You still can't say it in their words. Every pitch you write depends on it.",
        tier: "cash",
        ruleEventType: "client_why_logged",
        source: "gmail",
        prep: {
          type: "gmail_draft",
          summary: "Drafted a 2-line message in your tone, for your longest-running client.",
          draftLabel: "DRAFT · EMAIL · TU",
          draft: "Ciao [NOME], domanda secca: se domani Eracolo sparisse, cosa ti mancherebbe di più?\nMi basta una riga, sincera.",
          action: { label: "Open Gmail draft" },
        },
      },
      {
        userId: u.id,
        date: today,
        position: 1,
        title: "Book a check-in with both trial clients",
        why: "A trial only proves fit if it converts. Neither has a call on the calendar.",
        tier: "pipeline",
        ruleEventType: "prospect_meeting_booked",
        targetCount: 2,
        source: "calendar",
        prep: {
          type: "calendar_hold",
          summary: "Found 2 free slots and drafted both holds.",
          draftLabel: "PROPOSED SLOTS",
          draft: "Tue 10:00 · 20 min · [TRIAL CLIENT A]\nWed 15:00 · 20 min · [TRIAL CLIENT B]",
          action: { label: "Confirm holds" },
        },
      },
      {
        userId: u.id,
        date: today,
        position: 2,
        title: "Deal 25 damage to the ICP backlog",
        why: "Boss is above 400 HP. I pre-scored the next 25, you just confirm or kill.",
        tier: "groundwork",
        ruleEventType: "icp_task_closed",
        targetCount: 25,
        source: "attio",
        prep: {
          type: "icp_review",
          summary: "18 of 25 look like clear fits. 7 need your eye.",
          draftLabel: "NEEDS YOUR EYE",
          draft: "7 companies where geography or B2C is unclear.\nAverage decision time last week: 9 seconds.",
          action: { label: "Start rapid review", href: "/review" },
        },
      },
    ]);

    await db.insert(schema.loot).values([
      { userId: u.id, name: "Guilt-free day off", unlockCondition: { type: "streak", days: 10 } },
      { userId: u.id, name: "Dinner out", unlockCondition: { type: "level", level: 5 } },
      { userId: u.id, name: "New headphones", unlockCondition: { type: "boss_defeated" } },
    ]);

    await db.insert(schema.gmMessages).values([
      {
        userId: u.id,
        kind: "brief",
        title: "Cash hasn't moved in 4 days. Today I'm pointing you at clients, and I've already done the prep.",
        content:
          "Yesterday was almost all Groundwork. Useful, but it's the easy kind. I've doubled Cash points for 48 hours and drafted everything below. You review, I execute.",
        createdAt: at(today, 7, 45),
      },
      {
        userId: u.id,
        kind: "pattern",
        title: "Replies come in more often when your first line names a real price gap.",
        content: "So next week's boss is rewriting step 1 of the outbound sequence. I'll draft three versions on Monday; you pick one.",
        createdAt: at(addDays(today, -1), 17),
      },
    ]);
  }

  const companies = [
    ["Bottega Verdi", "IT · home & garden · 4.2k SKUs · Shopify", 88, "Mid-size catalog, sells branded products also on Amazon IT. Classic price-gap pain."],
    ["Casa Lume", "IT · lighting · 1.1k SKUs · WooCommerce", 81, "Branded lighting with 6+ visible resellers. Price pressure likely."],
    ["Ferramenta Online Rossi", "IT · DIY tools · 9k SKUs · Magento", 92, "Large catalog of branded tools, heavily compared on Trovaprezzi."],
    ["Moda Nordest", "IT · fashion · own brand", 34, "Own-label fashion: no identical SKUs at competitors, matching would be weak."],
    ["PetPiù", "IT · pet food · 2.3k SKUs · PrestaShop", 86, "Branded pet food is a price-comparison category."],
    ["Velo Store", "IT/AT · bikes & parts · 6k SKUs", 77, "Strong fit on parts; geography mixed (AT site). Needs your eye."],
    ["Gusto Box", "IT · food subscription · B2C boxes", 22, "Subscription bundles, no comparable SKUs."],
    ["ElettroCasa Sud", "IT · appliances · 3.5k SKUs", 90, "Appliances: high ticket, high price sensitivity, many competitors."],
    ["Cartoleria Digitale", "IT · stationery · B2B + B2C", 58, "Half B2B with negotiated pricing. Unclear if public prices matter."],
    ["BabyNest", "IT · baby products · 1.8k SKUs", 83, "Branded baby gear, frequent promos at competitors."],
  ] as const;
  await db.insert(schema.icpCandidates).values(
    companies.map(([name, domain, aiScore, aiReasoning], i) => ({
      attioRecordId: `seed:${i}`,
      name: `${name} (sample)`,
      domain,
      aiScore,
      aiReasoning,
    })),
  );

  await db.insert(schema.syncState).values([
    { source: "attio" as const },
    { source: "lgm" as const },
    { source: "gmail" as const },
    { source: "calendar" as const },
  ]);
  console.log("sample data: quests, boss, modifier, loot, proofs, brief, pattern, ICP candidates");
}

async function main() {
  await seedRules();
  if (args.has("--rules")) return;
  const users = await seedUsers();

  const [real] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.events).where(not(like(schema.events.sourceId, "seed:%")));
  if (real.n > 0 && !args.has("--force")) {
    throw new Error(`${real.n} real events exist. Refusing to wipe them; pass --force if you really mean it.`);
  }
  await wipeGameTables();
  await seedSample(users);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
