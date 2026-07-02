import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlan, getCourseMap } from "@/lib/queries";
import { validatePlan } from "@/lib/validate-plan";
import { sortSemesters } from "@/lib/validate-plan";

export default async function SharedPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();

  const courseMap = await getCourseMap();
  const warnings = validatePlan(plan.data, courseMap);
  const ordered = sortSemesters(plan.data.semesters);

  const TERM_COLORS: Record<string, string> = {
    Fall: "bg-(--color-blue-soft) text-(--color-blue)",
    Spring: "bg-(--color-gold-soft) text-amber-800",
    Summer: "bg-green-50 text-green-800",
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-14">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="course-code text-xs text-(--color-ink-soft) mb-1">
            SHARED PLAN
          </p>
          <h1 className="font-serif text-2xl font-semibold">{plan.name}</h1>
        </div>
        <Link
          href="/planner"
          className="shrink-0 text-xs px-3 py-1.5 bg-(--color-blue) text-white rounded-sm hover:bg-(--color-blue)/90 transition-colors"
        >
          Build your own →
        </Link>
      </div>

      {warnings.length > 0 && (
        <div className="mb-6 rounded-sm border border-(--color-rust)/30 bg-(--color-rust-soft) px-4 py-3">
          <p className="course-code text-xs text-(--color-rust) mb-2">
            {warnings.length} prerequisite issue{warnings.length !== 1 ? "s" : ""} in this plan
          </p>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-(--color-rust) leading-snug mb-1">
              {w.message}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {ordered.map((sem) => {
          const semWarningCodes = new Set(
            warnings.filter((w) => w.semesterId === sem.id).map((w) => w.courseCode)
          );
          const units = sem.courseCodes.reduce(
            (acc, code) => acc + (courseMap.get(code)?.units ?? 0),
            0
          );
          return (
            <div
              key={sem.id}
              className="rounded-sm border border-(--color-rule) bg-(--color-paper-raised)"
            >
              <div className="px-3 pt-3 pb-2 border-b border-(--color-rule)">
                <div className="flex items-center justify-between">
                  <span
                    className={`course-code text-[10px] px-1.5 py-0.5 rounded-sm ${
                      TERM_COLORS[sem.term] ?? ""
                    }`}
                  >
                    {sem.term.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-(--color-ink-soft) course-code">
                    {units}u
                  </span>
                </div>
                <div className="text-xs font-medium mt-1">{sem.label}</div>
              </div>
              <div className="p-2 space-y-1.5">
                {sem.courseCodes.map((code) => {
                  const c = courseMap.get(code);
                  const hasWarn = semWarningCodes.has(code);
                  return (
                    <Link
                      key={code}
                      href={`/courses/${code}`}
                      className={`block rounded-sm border px-2 py-1.5 text-xs transition-colors ${
                        hasWarn
                          ? "border-(--color-rust)/50 bg-(--color-rust-soft)"
                          : "border-(--color-rule) hover:border-(--color-blue)"
                      }`}
                    >
                      <span
                        className={`course-code font-medium ${
                          hasWarn ? "text-(--color-rust)" : "text-(--color-blue)"
                        }`}
                      >
                        {c?.displayCode ?? code}
                      </span>
                      <div className="text-(--color-ink-soft) truncate mt-0.5">
                        {c?.title}
                      </div>
                    </Link>
                  );
                })}
                {sem.courseCodes.length === 0 && (
                  <div className="h-6 flex items-center">
                    <span className="text-[10px] text-(--color-ink-soft)/40">—</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 pt-4 border-t border-(--color-rule) text-xs text-(--color-ink-soft)">
        Plan ID: <span className="course-code">{id}</span>
      </div>
    </div>
  );
}
