import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

const ALLOWED_EVENTS = new Set(["course_added", "plan_saved", "planner_opened"]);

export async function POST(req: NextRequest) {
  try {
    const { event, anonId } = (await req.json()) as {
      event?: string;
      anonId?: string;
    };
    if (
      !event ||
      !ALLOWED_EVENTS.has(event) ||
      typeof anonId !== "string" ||
      anonId.length === 0 ||
      anonId.length > 64
    ) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    await ensureSchema();
    await db.execute({
      sql: "INSERT INTO events (anon_id, event) VALUES (?, ?)",
      args: [anonId, event],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
