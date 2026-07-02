// A prerequisite requirement is a small boolean expression tree, because real
// prereqs aren't simple chains — e.g. CS 161 requires CS61B AND CS70 AND CS61C,
// while CS 188 requires (CS61A OR CS61B) AND CS70. Modeling this as a flat
// edge list (like a typical "prereq graph" toy project does) can't represent
// the OR case correctly, so a leaf-node "is this satisfied" check would be wrong.

export type PrereqExpr = CourseRef | AndExpr | OrExpr;

export interface CourseRef {
  type: "COURSE";
  code: string;
}

export interface AndExpr {
  type: "AND";
  items: PrereqExpr[];
}

export interface OrExpr {
  type: "OR";
  items: PrereqExpr[];
}

export interface CourseRecord {
  code: string;
  displayCode: string;
  title: string;
  department: string;
  units: number;
  description: string;
  prereqExpr: PrereqExpr | null;
}

export interface Semester {
  id: string;
  label: string; // e.g. "Fall 2026"
  year: number;
  term: "Fall" | "Spring" | "Summer";
  courseCodes: string[];
}

export interface PlanData {
  semesters: Semester[];
}

export interface PlanWarning {
  semesterId: string;
  courseCode: string;
  message: string;
}

// ── Major requirements ───────────────────────────────────────────────────

export interface RequirementGroup {
  id: string;
  label: string;
  type: "all" | "n-of";
  n?: number;
  courses: string[];
  note?: string;
}

export interface Major {
  id: string;
  name: string;
  shortName: string;
  college: string;
  requirements: RequirementGroup[];
}

export interface RequirementStatus {
  groupId: string;
  satisfied: boolean;
  completed: string[];
  remaining: string[];
}
