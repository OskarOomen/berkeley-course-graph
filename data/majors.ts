/**
 * Major requirements data
 * =======================
 * Sources:
 *  CS BA:         https://eecs.berkeley.edu/resources/undergrads/cs/degree-reqs/
 *  EECS BS:       https://eecs.berkeley.edu/resources/undergrads/ece-major-information/
 *  Data Sci BS:   https://data.berkeley.edu/degrees/data-science-ba
 *
 * Course codes must exactly match what's stored in the database (from the
 * scraper). Key ones: CS61A, CS61B, CS61C, CS70, MATH1A, MATH1B, MATH53,
 * MATH54, EECS16A, EECS16B.
 *
 * Simplifications for v1 (documented here):
 *  - Physics (PHYS7A/7B) and ENGIN7 are not yet in the catalog, so they
 *    appear as notes rather than tracked courses.
 *  - CS BA upper-division breadth areas are collapsed into one "pick 4"
 *    group for simplicity; the real requirement is 4 courses spanning 4
 *    of 5 breadth areas.
 *  - EECS BS upper-division requirement is 20 units (~5 courses); we list
 *    the most common picks rather than the full approved list.
 */

import type { Major } from "../lib/types";

export const MAJORS: Major[] = [
  // ── Computer Science B.A. (L&S) ─────────────────────────────────────────
  {
    id: "cs-ba",
    name: "Computer Science B.A.",
    shortName: "CS BA",
    college: "College of Letters & Science",
    requirements: [
      {
        id: "cs-ba-lower-cs",
        label: "Lower Division — CS Core",
        type: "all",
        courses: ["CS61A", "CS61B", "CS61C", "CS70"],
      },
      {
        id: "cs-ba-lower-math",
        label: "Lower Division — Math",
        type: "all",
        courses: ["MATH1A", "MATH1B", "MATH53", "MATH54"],
      },
      {
        id: "cs-ba-ud-required",
        label: "Upper Division — Required",
        type: "all",
        courses: ["CS170"],
      },
      {
        id: "cs-ba-ud-breadth",
        label: "Upper Division — Breadth (4 courses)",
        type: "n-of",
        n: 4,
        courses: [
          // Theory
          "CS171", "CS172", "CS174", "CSC187",
          // Software Systems
          "CS160", "CS161", "CS162", "CS164", "CS168", "CS186",
          // AI / ML
          "CS188", "CS189", "CSC182", "CS180",
          // Architecture
          "CS150", "CS152",
          // Applications / other
          "CS184", "CSC176", "PHYSC191A",
        ],
        note: "Must span at least 4 of the 5 breadth areas (Theory, Systems, AI, Architecture, Applications).",
      },
    ],
  },

  // ── EECS B.S. (College of Engineering) ──────────────────────────────────
  {
    id: "eecs-bs",
    name: "EECS B.S.",
    shortName: "EECS BS",
    college: "College of Engineering",
    requirements: [
      {
        id: "eecs-bs-lower-cs",
        label: "Lower Division — CS Core",
        type: "all",
        courses: ["CS61A", "CS61B", "CS61C", "CS70"],
      },
      {
        id: "eecs-bs-lower-ee",
        label: "Lower Division — EE Core",
        type: "all",
        courses: ["EECS16A", "EECS16B"],
        note: "EECS 16A and 16B (also listed as EE 64 / EE 66 in the new numbering).",
      },
      {
        id: "eecs-bs-lower-math",
        label: "Lower Division — Math",
        type: "all",
        courses: ["MATH1A", "MATH1B", "MATH53", "MATH54"],
      },
      {
        id: "eecs-bs-ud",
        label: "Upper Division — EECS (20 units, ~5 courses)",
        type: "n-of",
        n: 5,
        courses: [
          "CS150", "CS152", "CS160", "CS161", "CS162", "CS164",
          "CS168", "CS170", "CS172", "CS174", "CS176",
          "CS180", "CSC182", "CS184", "CS186", "CS188", "CS189",
          "EECS126", "EECS127", "EECS149", "EECS151",
          "EE105", "EE120", "EE121", "EE122", "EE123",
        ],
        note: "At least 20 units total; one course must satisfy the major design experience requirement.",
      },
    ],
  },

  // ── Data Science B.A. (CDSS) ────────────────────────────────────────────
  {
    id: "ds-ba",
    name: "Data Science B.A.",
    shortName: "Data Sci BA",
    college: "College of Computing, Data Science & Society",
    requirements: [
      {
        id: "ds-ba-foundations",
        label: "Foundations",
        type: "all",
        courses: ["STATC8", "CS61A", "CS61B"],
        note: "CS C8 (Foundations of Data Science) is the entry point. CS 61A and 61B can be replaced by Data C88C + one other.",
      },
      {
        id: "ds-ba-math",
        label: "Math & Stats",
        type: "all",
        courses: ["MATH1A", "MATH1B", "MATH54"],
      },
      {
        id: "ds-ba-core",
        label: "Core Upper Division",
        type: "all",
        courses: ["STATC100", "CS189"],
        note: "Data C100 (Principles & Techniques of Data Science) and a modeling/inference course.",
      },
      {
        id: "ds-ba-domain",
        label: "Domain Emphasis (3 courses)",
        type: "n-of",
        n: 3,
        courses: [
          "CS161", "CS162", "CS168", "CS170", "CS172", "CS174",
          "CS186", "CS188", "CSC182", "CS180", "CS184",
          "EECS126", "EECS127",
        ],
        note: "3 upper-division courses in a declared domain emphasis area.",
      },
    ],
  },

  // ── Mathematics B.A. (L&S) ──────────────────────────────────────────────
  // Source: https://math.berkeley.edu/undergraduate/major/pure
  // Note: Math 51/52 are the new numbers for 1A/1B — either satisfies.
  {
    id: "math-ba",
    name: "Mathematics B.A.",
    shortName: "Math BA",
    college: "College of Letters & Science",
    requirements: [
      {
        id: "math-ba-calc",
        label: "Calculus (Math 51/1A and 52/1B)",
        type: "n-of",
        n: 2,
        courses: ["MATH51", "MATH1A", "MATH52", "MATH1B"],
      },
      {
        id: "math-ba-lower",
        label: "Multivariable Calculus & Discrete Math",
        type: "all",
        courses: ["MATH53", "MATH55"],
      },
      {
        id: "math-ba-linalg",
        label: "Linear Algebra & Differential Equations (54 or 56)",
        type: "n-of",
        n: 1,
        courses: ["MATH54", "MATH56"],
      },
      {
        id: "math-ba-ud-core",
        label: "Upper Division — Core",
        type: "all",
        courses: ["MATH104", "MATH110", "MATH113", "MATH185"],
      },
      {
        id: "math-ba-ud-electives",
        label: "Upper Division — Electives (4 courses)",
        type: "n-of",
        n: 4,
        courses: [
          "MATHC103", "MATH105", "MATH114", "MATH115", "MATH116", "MATH118",
          "MATH121A", "MATH121B", "MATH123", "MATH124", "MATH125A", "MATH126",
          "MATH127", "MATH128A", "MATH128B", "MATH130", "MATH135", "MATH136",
          "MATH140", "MATH141", "MATH142", "MATH143", "MATH156", "MATH160",
          "MATH170", "MATH172", "MATH189",
        ],
      },
    ],
  },

  // ── Applied Mathematics B.A. (L&S) ──────────────────────────────────────
  // Source: https://math.berkeley.edu/undergraduate/major/applied
  {
    id: "applied-math-ba",
    name: "Applied Mathematics B.A.",
    shortName: "Applied Math BA",
    college: "College of Letters & Science",
    requirements: [
      {
        id: "amath-calc",
        label: "Calculus (Math 51/1A and 52/1B)",
        type: "n-of",
        n: 2,
        courses: ["MATH51", "MATH1A", "MATH52", "MATH1B"],
      },
      {
        id: "amath-lower",
        label: "Multivariable Calculus & Discrete Math",
        type: "all",
        courses: ["MATH53", "MATH55"],
      },
      {
        id: "amath-linalg",
        label: "Linear Algebra & Differential Equations (54 or 56)",
        type: "n-of",
        n: 1,
        courses: ["MATH54", "MATH56"],
      },
      {
        id: "amath-ud-core",
        label: "Upper Division — Core (incl. Math 128A)",
        type: "all",
        courses: ["MATH104", "MATH110", "MATH113", "MATH128A", "MATH185"],
      },
      {
        id: "amath-cluster",
        label: "Applied Cluster (3 courses, advisor-approved)",
        type: "n-of",
        n: 3,
        courses: [
          "MATH121A", "MATH121B", "MATH123", "MATH126", "MATH128B",
          "MATH170", "MATH172", "STAT134", "STAT135", "STAT151A",
          "CS170", "CS189", "ME104", "ME106", "PHYS105", "IEOR160",
        ],
      },
    ],
  },

  // ── Statistics B.A. (L&S) ───────────────────────────────────────────────
  // Source: https://statistics.berkeley.edu/academics/undergrad/major
  // Simplification: the real cluster requirement is 3 thematically-linked
  // courses from an approved cross-department list; we show popular picks.
  {
    id: "stat-ba",
    name: "Statistics B.A.",
    shortName: "Stat BA",
    college: "College of Letters & Science",
    requirements: [
      {
        id: "stat-calc",
        label: "Calculus (Math 51/1A and 52/1B)",
        type: "n-of",
        n: 2,
        courses: ["MATH51", "MATH1A", "MATH52", "MATH1B"],
      },
      {
        id: "stat-lower",
        label: "Multivariable Calculus",
        type: "all",
        courses: ["MATH53"],
      },
      {
        id: "stat-linalg",
        label: "Linear Algebra & Differential Equations (54 or 56)",
        type: "n-of",
        n: 1,
        courses: ["MATH54", "MATH56"],
      },
      {
        id: "stat-ud-core",
        label: "Upper Division — Core",
        type: "all",
        courses: ["STAT133", "STAT135"],
      },
      {
        id: "stat-prob",
        label: "Probability (Stat 134 or Data/Stat C140)",
        type: "n-of",
        n: 1,
        courses: ["STAT134", "STATC140"],
      },
      {
        id: "stat-ud-electives",
        label: "Upper Division — Statistics Electives (3 courses)",
        type: "n-of",
        n: 3,
        courses: [
          "STATC100", "STATC102", "STAT150", "STAT151A", "STAT152",
          "STAT153", "STAT154", "STAT155", "STAT157", "STAT158", "STAT159",
        ],
      },
      {
        id: "stat-cluster",
        label: "Cluster (3 related courses — popular picks shown)",
        type: "n-of",
        n: 3,
        courses: [
          "CS161", "CS162", "CS170", "CS186", "CS188", "CS189",
          "IEOR160", "IEOR162", "IEOR166", "MATH104", "MATH110", "MATH128A",
        ],
      },
    ],
  },
];

export const MAJOR_MAP = new Map(MAJORS.map((m) => [m.id, m]));
