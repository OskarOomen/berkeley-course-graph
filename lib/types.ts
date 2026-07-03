// The prerequisite requirements for each course are a boolean expression tree.
// This is because we cannot treat prerequisites as just chains - e.g. CS 161
// requires CS61B AND CS70 AND CS61C, while CS 188 requires (CS61A OR CS61B)
// AND CS70. Modeling this as a flat edge list would not represent the OR case
// and so leaf-node checks to see if prerequisites are satisfied could return
// the wrong answer

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
  label: string; // For example "Fall 2026"
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
