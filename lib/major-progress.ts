import type { Major, PlanData, RequirementStatus } from "./types";

/**
 * Given a major and the current plan, return the satisfaction status of
 * every requirement group. A course counts as "completed" if it appears
 * in ANY semester in the plan (regardless of whether prereqs are satisfied —
 * that's validated separately).
 */
export function checkMajorProgress(
  major: Major,
  plan: PlanData
): RequirementStatus[] {
  const placed = new Set(plan.semesters.flatMap((s) => s.courseCodes));

  return major.requirements.map((group) => {
    const completed = group.courses.filter((c) => placed.has(c));
    const remaining = group.courses.filter((c) => !placed.has(c));

    let satisfied: boolean;
    if (group.type === "all") {
      satisfied = remaining.length === 0;
    } else {
      satisfied = completed.length >= (group.n ?? 1);
    }

    return { groupId: group.id, satisfied, completed, remaining };
  });
}

/** How many requirement groups are fully satisfied. */
export function countSatisfied(statuses: RequirementStatus[]): number {
  return statuses.filter((s) => s.satisfied).length;
}
