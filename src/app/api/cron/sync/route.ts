import { NextResponse } from "next/server";

// Vercel Cron calls this every 15 minutes with `Authorization: Bearer $CRON_SECRET`.
// Phase 1 wires the Attio and Calendar sources in here; for now it only authenticates.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, synced: [], note: "No sources wired yet (Phase 1)." });
}
