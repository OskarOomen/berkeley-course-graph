import type { CourseRecord, PlanData, PlanWarning, Semester } from "./types";
import { isSatisfied, describeExpr } from "./graph";

const TERM_ORDER: Record<Semester["term"], number> = {
  Spring: 0,
  Summer: 1,
  Fall: 2,
};

/** Sort semesters chronologically (year, then term within year) */
export function sortSemesters(semesters: Semester[]): Semester[] {
  return [...semesters].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return TERM_ORDER[a.term] - TERM_ORDER[b.term];
  });
}

/**
 * Validate a full semester plan against prerequisite requirements
 *
 * Note that a course's prereqs must be satisfied by courses placed in
 * earlier semesters 
 */
export function validatePlan(
  plan: PlanData,
  courseMap: Map<string, CourseRecord>
): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const ordered = sortSemesters(plan.semesters);

  const completedBefore = new Set<string>();

  for (const semester of ordered) {
    for (const code of semester.courseCodes) {
      const course = courseMap.get(code);
      if (!course) continue;

      if (course.prereqExpr && !isSatisfied(course.prereqExpr, completedBefore)) {
        warnings.push({
          semesterId: semester.id,
          courseCode: code,
          message: `${course.displayCode} requires ${describeExpr(
            course.prereqExpr,
            (c) => courseMap.get(c)?.displayCode ?? c
          )} completed in an earlier semester.`,
        });
      }
    }
    // Only after finishing this semester's check do its courses become
    // completed for the next semester's evaluation
    for (const code of semester.courseCodes) {
      completedBefore.add(code);
    }
  }

  return warnings;
}

/** Detect a course placed in more than one semester in the same plan */
export function findDuplicatePlacements(plan: PlanData): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const semester of plan.semesters) {
    for (const code of semester.courseCodes) {
      if (seen.has(code)) dupes.add(code);
      seen.add(code);
    }
  }
  return [...dupes];
}
