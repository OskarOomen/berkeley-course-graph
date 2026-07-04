import { notFound } from "next/navigation";
import Link from "next/link";
import { getCourseByCode} from "@/lib/queries";
import { buildGraph, getFullPrereqChain, getDownstreamCourses, describeExpr } from "@/lib/graph";
import { getAllCourses } from "@/lib/queries";
import { PrereqDiagram } from "@/app/components/PrereqDiagram";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const course = await getCourseByCode(code);
  if (!course) return {};
  return {
    title: `${course.displayCode} — ${course.title} | Berkeley Course Graph`,
  };
}

export default async function CoursePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [course, allCourses] = await Promise.all([
    getCourseByCode(code),
    getAllCourses(),
  ]);
  if (!course) notFound();

  const courseMap = new Map(allCourses.map((c) => [c.code, c]));
  const graph = buildGraph(allCourses);
  const prereqChain = getFullPrereqChain(graph, course.code);
  const downstream = getDownstreamCourses(graph, course.code);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
      <Link
        href="/"
        className="course-code text-xs text-(--color-ink-soft) hover:text-(--color-blue) transition-colors"
      >
        ← All courses
      </Link>

      <div className="mt-6 mb-8">
        <div className="flex items-start gap-4 flex-wrap">
          <span className="course-code text-sm px-2 py-1 bg-(--color-blue) text-white rounded-sm shrink-0">
            {course.displayCode}
          </span>
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold leading-tight">
              {course.title}
            </h1>
            <p className="text-sm text-(--color-ink-soft) mt-1">
              {course.department} · {course.units} units
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-(--color-ink) leading-relaxed max-w-prose">
          {course.description}
        </p>
      </div>

      {/* Prereq diagram */}
      <section className="mb-10">
        <h2 className="course-code text-xs text-(--color-ink-soft) uppercase tracking-wide mb-4 pb-2 border-b border-(--color-rule)">
          Prerequisite graph
        </h2>
        <PrereqDiagram course={course} courseMap={courseMap} />
        {course.prereqExpr && (
          <p className="mt-3 text-xs text-(--color-ink-soft)">
            Requires:{" "}
            <span className="text-(--color-ink)">
              {describeExpr(course.prereqExpr, (c) => courseMap.get(c)?.displayCode ?? c)}
            </span>
          </p>
        )}
      </section>

      {/* Full ancestor chain */}
      {prereqChain.length > 0 && (
        <section className="mb-10">
          <h2 className="course-code text-xs text-(--color-ink-soft) uppercase tracking-wide mb-4 pb-2 border-b border-(--color-rule)">
            Full prerequisite chain ({prereqChain.length} courses)
          </h2>
          <ul className="space-y-1">
            {prereqChain.map((c) => {
              const cr = courseMap.get(c);
              return (
                <li key={c}>
                  <Link
                    href={`/courses/${c}`}
                    className="flex items-center gap-3 text-sm hover:text-(--color-blue) transition-colors group py-1"
                  >
                    <span className="course-code text-[11px] w-16 text-(--color-blue) shrink-0">
                      {cr?.displayCode ?? c}
                    </span>
                    <span className="text-(--color-ink-soft) group-hover:text-(--color-blue) transition-colors">
                      {cr?.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Downstream unlocked courses */}
      {downstream.length > 0 && (
        <section className="mb-10">
          <h2 className="course-code text-xs text-(--color-ink-soft) uppercase tracking-wide mb-4 pb-2 border-b border-(--color-rule)">
            Courses this unlocks ({downstream.length})
          </h2>
          <ul className="space-y-1">
            {downstream.map((c) => {
              const cr = courseMap.get(c);
              return (
                <li key={c}>
                  <Link
                    href={`/courses/${c}`}
                    className="flex items-center gap-3 text-sm py-1 group"
                  >
                    <span className="course-code text-[11px] w-16 text-(--color-blue) shrink-0">
                      {cr?.displayCode ?? c}
                    </span>
                    <span className="text-(--color-ink-soft) group-hover:text-(--color-blue) transition-colors">
                      {cr?.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="pt-4 border-t border-(--color-rule)">
        <Link
          href="/planner"
          className="inline-flex items-center gap-2 text-sm text-(--color-blue) hover:underline"
        >
          Add {course.displayCode} to your semester plan →
        </Link>
      </div>
    </div>
  );
}
