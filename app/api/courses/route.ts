import { NextResponse } from "next/server";
import { getAllCourses } from "@/lib/queries";

export async function GET() {
  try {
    const courses = await getAllCourses();
    return NextResponse.json(courses);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}
