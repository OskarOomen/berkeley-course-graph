import { NextRequest, NextResponse } from "next/server";
import { getPlan, updatePlan } from "@/lib/queries";
import type { PlanData } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const plan = await getPlan(id);
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    return NextResponse.json(plan);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load plan" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { data, name } = body as { data: PlanData; name?: string };
    if (!data?.semesters) {
      return NextResponse.json({ error: "Invalid plan data" }, { status: 400 });
    }
    const ok = await updatePlan(id, data, name);
    if (!ok) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
