import { NextRequest, NextResponse } from "next/server";
import { createPlan } from "@/lib/queries";
import type { PlanData } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, name } = body as { data: PlanData; name?: string };
    if (!data?.semesters || !Array.isArray(data.semesters)) {
      return NextResponse.json({ error: "Invalid plan data" }, { status: 400 });
    }
    const id = await createPlan(data, name ?? "My 4-Year Plan");
    return NextResponse.json({ id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
