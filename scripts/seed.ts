import { db, ensureSchema } from "../lib/db";
import { seedCourses } from "../data/seed-courses";

async function main() {
  await ensureSchema();
  console.log(`Seeding ${seedCourses.length} courses...`);

  for (const c of seedCourses) {
    await db.execute({
      sql: `
        INSERT INTO courses (code, display_code, title, department, units, description, prereq_expr)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          display_code = excluded.display_code,
          title = excluded.title,
          department = excluded.department,
          units = excluded.units,
          description = excluded.description,
          prereq_expr = excluded.prereq_expr
      `,
      args: [
        c.code,
        c.displayCode,
        c.title,
        c.department,
        c.units,
        c.description,
        c.prereqExpr ? JSON.stringify(c.prereqExpr) : null,
      ],
    });
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit(0));
