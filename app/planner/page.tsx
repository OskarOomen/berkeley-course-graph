import { ensureSchema } from "@/lib/db";
import PlannerClient from "./PlannerClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Semester Planner | Berkeley Course Graph",
};

export default async function PlannerPage() {
  // Ensure the schema exists before the client component hits /api/courses
  await ensureSchema();
  return <PlannerClient />;
}
