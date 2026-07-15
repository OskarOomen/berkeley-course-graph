import { searchCourses, getStats } from "@/lib/queries";
import Link from "next/link";
import SearchBox from "./components/SearchBox";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const courses = await searchCourses(q);
  const stats = await getStats();

  const byDept = new Map<string, typeof courses>();
  for (const c of courses) {
    if (!byDept.has(c.department)) byDept.set(c.department, []);
    byDept.get(c.department)!.push(c);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
      <p className="course-code text-xs text-(--color-blue) mb-3">
        UC BERKELEY · COURSE GRAPH
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold leading-tight mb-3">
        See the prerequisite chain before you build the plan.
      </h1>
      <p className="text-(--color-ink-soft) mb-8 max-w-xl">
        Search a course, see exactly what it requires, and lay out your
        semesters with automatic prerequisite checking.
      </p>

      <SearchBox initialQuery={q} />

      {courses.length === 0 ? (
        <p className="text-sm text-(--color-ink-soft) border-t border-(--color-rule) pt-6">
          No courses match &ldquo;{q}&rdquo;. This catalog currently covers
          the CS/EECS/Math core — try a course code like{" "}
          <span className="course-code">CS61B</span>.
        </p>
      ) : (
        <div className="space-y-8">
          {[...byDept.entries()].map(([dept, list]) => (
            <div key={dept}>
              <h2 className="course-code text-xs text-(--color-ink-soft) uppercase tracking-wide mb-2 pb-2 border-b border-(--color-rule)">
                {dept}
              </h2>
              <ul>
                {list.map((c) => (
                  <li key={c.code} className="border-b border-(--color-rule)">
                    <Link
                      href={`/courses/${c.code}`}
                      className="flex items-center gap-4 py-3 group"
                    >
                      <span className="course-code text-xs w-20 shrink-0 px-1.5 py-0.5 bg-(--color-blue-soft) text-(--color-blue) rounded-sm text-center">
                        {c.displayCode}
                      </span>
                      <span className="flex-1 text-sm group-hover:text-(--color-blue) transition-colors">
                        {c.title}
                      </span>
                      <span className="text-xs text-(--color-ink-soft)">
                        {c.units} units
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-16 pt-6 border-t border-(--color-rule) flex items-center justify-between text-xs text-(--color-ink-soft)">
        <span>{stats.totalCourses} courses · CDSS, Math &amp; College of Engineering</span>
        <Link href="/planner" className="text-(--color-blue) hover:underline">
          Start a plan →
        </Link>
      </div>
    </div>
  );
}
