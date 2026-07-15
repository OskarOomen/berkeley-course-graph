import { db, ensureSchema } from "./db";
import type { CourseRecord, PlanData } from "./types";
import { nanoid } from "nanoid";
import { expandDeptAlias } from "./dept-aliases";

interface CourseRow {
  code: string;
  display_code: string;
  title: string;
  department: string;
  units: number;
  description: string;
  prereq_expr: string | null;
}

function rowToCourse(row: CourseRow): CourseRecord {
  return {
    code: row.code,
    displayCode: row.display_code,
    title: row.title,
    department: row.department,
    units: row.units,
    description: row.description,
    prereqExpr: row.prereq_expr ? JSON.parse(row.prereq_expr) : null,
  };
}

export async function getAllCourses(): Promise<CourseRecord[]> {
  await ensureSchema();
  const result = await db.execute("SELECT * FROM courses ORDER BY department, code");
  return (result.rows as unknown as CourseRow[]).map(rowToCourse);
}

export async function getCourseByCode(code: string): Promise<CourseRecord | null> {
  await ensureSchema();
  const result = await db.execute({
    sql: "SELECT * FROM courses WHERE code = ?",
    args: [code],
  });
  if (result.rows.length === 0) return null;
  return rowToCourse(result.rows[0] as unknown as CourseRow);
}

export async function searchCourses(query: string): Promise<CourseRecord[]> {
  await ensureSchema();
  const q = query.trim();
  if (!q) return getAllCourses();

  const like = `%${q.toLowerCase()}%`;
  const expandedLike = `%${expandDeptAlias(q).toLowerCase()}%`;

  const result = await db.execute({
    sql: `
      SELECT * FROM courses
      WHERE lower(display_code) LIKE ?
         OR lower(code) LIKE ?
         OR lower(title) LIKE ?
         OR lower(display_code) LIKE ?
         OR lower(code) LIKE ?
      ORDER BY
        CASE WHEN lower(display_code) LIKE ? OR lower(code) LIKE ? THEN 0 ELSE 1 END,
        department, code
    `,
    args: [like, like, like, expandedLike, expandedLike, expandedLike, expandedLike],
  });
  return (result.rows as unknown as CourseRow[]).map(rowToCourse);
}

export async function getCourseMap(): Promise<Map<string, CourseRecord>> {
  const all = await getAllCourses();
  return new Map(all.map((c) => [c.code, c]));
}

// --- Plans ---

interface PlanRow {
  id: string;
  name: string;
  data: string;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export async function createPlan(data: PlanData, name = "My 4-Year Plan"): Promise<string> {
  await ensureSchema();
  const id = nanoid(8);
  await db.execute({
    sql: "INSERT INTO plans (id, name, data) VALUES (?, ?, ?)",
    args: [id, name, JSON.stringify(data)],
  });
  return id;
}

export async function getPlan(
  id: string
): Promise<{ id: string; name: string; data: PlanData } | null> {
  await ensureSchema();
  const result = await db.execute({
    sql: "SELECT * FROM plans WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as unknown as PlanRow;

  db.execute({
    sql: "UPDATE plans SET view_count = view_count + 1 WHERE id = ?",
    args: [id],
  }).catch(() => {});

  return { id: row.id, name: row.name, data: JSON.parse(row.data) };
}

export async function updatePlan(id: string, data: PlanData, name?: string): Promise<boolean> {
  await ensureSchema();
  const result = await db.execute({
    sql: name
      ? "UPDATE plans SET data = ?, name = ?, updated_at = datetime('now') WHERE id = ?"
      : "UPDATE plans SET data = ?, updated_at = datetime('now') WHERE id = ?",
    args: name ? [JSON.stringify(data), name, id] : [JSON.stringify(data), id],
  });
  return result.rowsAffected > 0;
}

export async function getStats(): Promise<{ totalPlans: number; totalViews: number; totalCourses: number }> {
  await ensureSchema();
  const result = await db.execute(
    "SELECT COUNT(*) as count, COALESCE(SUM(view_count), 0) as views FROM plans"
  );
  const row = result.rows[0] as unknown as { count: number; views: number };
  const courses = await db.execute("SELECT COUNT(*) as n FROM courses");
  const cRow = courses.rows[0] as unknown as { n: number };
  return { totalPlans: row.count, totalViews: row.views, totalCourses: cRow.n };
}
