import { describe, it, expect } from "vitest";
import { validatePlan, findDuplicatePlacements, sortSemesters } from "./validate-plan";
import type { CourseRecord, PlanData, Semester } from "./types";

const course = (code: string, prereqExpr: CourseRecord["prereqExpr"] = null): CourseRecord => ({
  code, displayCode: code, title: code, department: "TEST", units: 4, description: "", prereqExpr,
});

const sem = (id: string, term: Semester["term"], year: number, courseCodes: string[]): Semester => ({
  id, label: `${term} ${year}`, term, year, courseCodes,
});

// CS61B requires CS61A; CS70 requires nothing
const courseMap = new Map<string, CourseRecord>([
  ["CS61A", course("CS61A")],
  ["CS61B", course("CS61B", { type: "COURSE", code: "CS61A" })],
  ["CS70", course("CS70")],
  ["CS170", course("CS170", {
    type: "AND",
    items: [{ type: "COURSE", code: "CS61B" }, { type: "COURSE", code: "CS70" }],
  })],
]);

describe("validatePlan: chronology rules", () => {
  it("passes when prereq is in an earlier semester", () => {
    const plan: PlanData = { semesters: [
      sem("s1", "Fall", 2026, ["CS61A"]),
      sem("s2", "Spring", 2027, ["CS61B"]),
    ]};
    expect(validatePlan(plan, courseMap)).toEqual([]);
  });

  it("warns when prereq is missing entirely", () => {
    const plan: PlanData = { semesters: [sem("s1", "Fall", 2026, ["CS61B"])] };
    const warnings = validatePlan(plan, courseMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].courseCode).toBe("CS61B");
  });

  it("warns when prereq is in the same sem (strictly-earlier rule)", () => {
    const plan: PlanData = { semesters: [sem("s1", "Fall", 2026, ["CS61A", "CS61B"])] };
    expect(validatePlan(plan, courseMap)).toHaveLength(1);
  });

  it("same-semester result does not depend on array order", () => {
    const plan: PlanData = { semesters: [sem("s1", "Fall", 2026, ["CS61B", "CS61A"])] };
    expect(validatePlan(plan, courseMap)).toHaveLength(1);
  });

  it("warns when prereq is in a later sem", () => {
    const plan: PlanData = { semesters: [
      sem("s1", "Fall", 2026, ["CS61B"]),
      sem("s2", "Spring", 2027, ["CS61A"]),
    ]};
    expect(validatePlan(plan, courseMap)).toHaveLength(1);
  });

  it("evaluates AND prereqs: one branch met, one missing -> warns", () => {
    const plan: PlanData = { semesters: [
      sem("s1", "Fall", 2026, ["CS61A"]),
      sem("s2", "Spring", 2027, ["CS61B"]),
      sem("s3", "Fall", 2027, ["CS170"]), // has 61B but never took CS70
    ]};
    const warnings = validatePlan(plan, courseMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].courseCode).toBe("CS170");
  });

  it("ignores course codes not in the catalog", () => {
    const plan: PlanData = { semesters: [sem("s1", "Fall", 2026, ["NOTREAL999"])] };
    expect(validatePlan(plan, courseMap)).toEqual([]);
  });
});

describe("sortSemesters", () => {
  it("orders by year then Spring < Summer < Fall", () => {
    const out = sortSemesters([
      sem("a", "Fall", 2027, []),
      sem("b", "Spring", 2027, []),
      sem("c", "Fall", 2026, []),
      sem("d", "Summer", 2027, []),
    ]);
    expect(out.map((s) => s.id)).toEqual(["c", "b", "d", "a"]);
  });
});

describe("findDuplicatePlacements", () => {
  it("flags a course placed in two semesters", () => {
    const plan: PlanData = { semesters: [
      sem("s1", "Fall", 2026, ["CS61A"]),
      sem("s2", "Spring", 2027, ["CS61A"]),
    ]};
    expect(findDuplicatePlacements(plan)).toEqual(["CS61A"]);
  });

  it("returns empty for a clean plan", () => {
    const plan: PlanData = { semesters: [
      sem("s1", "Fall", 2026, ["CS61A"]),
      sem("s2", "Spring", 2027, ["CS61B"]),
    ]};
    expect(findDuplicatePlacements(plan)).toEqual([]);
  });
});