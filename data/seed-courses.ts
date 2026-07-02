// Seed data for Berkeley Course Graph.
//
// SCOPE: This intentionally covers the CS/EECS/Math lower-division core plus
// a set of popular upper-division CS courses, not the entire UC Berkeley
// catalog. Prereqs were pulled from official EECS course pages
// (www2.eecs.berkeley.edu/Courses/...) and current course-policy pages where
// the official catalog entry was ambiguous or out of date. A few notes on
// simplifications made for this dataset (documented here on purpose, since
// "what did you simplify and why" is exactly the kind of question this
// project should be able to answer in an interview):
//
//  - CS70 has no campus-enforced formal prerequisite. CS61A is the de facto
//    "you should be comfortable with this first" expectation, but since it
//    isn't system-enforced, we model it here as having NO prereq, to keep
//    the graph honest about what's actually required vs. just advised.
//  - CS61A's prereq is "Math 1A as prereq-or-corequisite", which is a
//    looser relationship than the strict prereqs elsewhere in this graph.
//    We omit it here so CS61A can serve as a clean root node; Math 1A is
//    still in the dataset and feeds the EECS16A/Math53/Math54 branch.
//  - CS61B accepts CS61A, CS88, or Engin 7. Engin 7 is out of scope for this
//    dataset (it's a College of Engineering intro course, not CS/EECS/Math),
//    so the OR only includes CS61A and CS88 here.
//
// Extending this file is the main way to grow the catalog — add a course
// object below and re-run `npm run db:seed`.

import type { PrereqExpr } from "../lib/types";

const course = (code: string): PrereqExpr => ({ type: "COURSE", code });
const and = (...items: PrereqExpr[]): PrereqExpr => ({ type: "AND", items });
const or = (...items: PrereqExpr[]): PrereqExpr => ({ type: "OR", items });

export interface SeedCourse {
  code: string;
  displayCode: string;
  title: string;
  department: string;
  units: number;
  description: string;
  prereqExpr: PrereqExpr | null;
}

export const seedCourses: SeedCourse[] = [
  {
    code: "MATH1A",
    displayCode: "Math 1A",
    title: "Calculus",
    department: "Mathematics",
    units: 4,
    description:
      "Limits, continuity, differentiation, basic integration, and applications, for functions of one variable.",
    prereqExpr: null,
  },
  {
    code: "MATH1B",
    displayCode: "Math 1B",
    title: "Calculus",
    department: "Mathematics",
    units: 4,
    description:
      "Techniques of integration, applications of integration, infinite sequences and series, first-order ordinary differential equations.",
    prereqExpr: course("MATH1A"),
  },
  {
    code: "MATH53",
    displayCode: "Math 53",
    title: "Multivariable Calculus",
    department: "Mathematics",
    units: 4,
    description:
      "Parametric equations and polar coordinates, vectors in 2- and 3-dimensional Euclidean spaces, partial derivatives, multiple integrals, vector calculus.",
    prereqExpr: course("MATH1B"),
  },
  {
    code: "MATH54",
    displayCode: "Math 54",
    title: "Linear Algebra and Differential Equations",
    department: "Mathematics",
    units: 4,
    description:
      "Basic linear algebra: matrix arithmetic and determinants, vector spaces, eigenvalues and eigenvectors, linear transformations. First-order ODEs, second order linear ODEs.",
    prereqExpr: course("MATH1B"),
  },
  {
    code: "EECS16A",
    displayCode: "EECS 16A",
    title: "Designing Information Devices and Systems I",
    department: "EECS",
    units: 4,
    description:
      "Foundational course in circuits and linear algebra, with applications to imaging, ranging, and state estimation.",
    prereqExpr: course("MATH1A"),
  },
  {
    code: "EECS16B",
    displayCode: "EECS 16B",
    title: "Designing Information Devices and Systems II",
    department: "EECS",
    units: 4,
    description:
      "Continuation of EECS 16A. Dynamical systems, feedback and control, circuits with op-amps, simple digital systems, Fourier analysis.",
    prereqExpr: course("EECS16A"),
  },
  {
    code: "CS61A",
    displayCode: "CS 61A",
    title: "Structure and Interpretation of Computer Programs",
    department: "Computer Science",
    units: 4,
    description:
      "Programming and computer science fundamentals: abstraction, recursion, higher-order functions, interpreters, and an introduction to data structures.",
    prereqExpr: null,
  },
  {
    code: "CS88",
    displayCode: "CS 88",
    title: "Computational Structures in Data Science",
    department: "Computer Science",
    units: 4,
    description:
      "An alternative on-ramp into the CS curriculum, covering core programming and data-manipulation concepts with an emphasis on data science applications.",
    prereqExpr: null,
  },
  {
    code: "CS61B",
    displayCode: "CS 61B",
    title: "Data Structures",
    department: "Computer Science",
    units: 4,
    description:
      "Fundamental dynamic data structures, including linked structures, trees, and hash tables. Sorting and searching algorithms. Introduction to the Java programming language and software engineering principles.",
    prereqExpr: or(course("CS61A"), course("CS88")),
  },
  {
    code: "CS61C",
    displayCode: "CS 61C",
    title: "Great Ideas in Computer Architecture",
    department: "Computer Science",
    units: 4,
    description:
      "Machine structures: C programming, assembly language, memory hierarchy, parallelism, and the hardware/software interface.",
    prereqExpr: course("CS61B"),
  },
  {
    code: "CS70",
    displayCode: "CS 70",
    title: "Discrete Mathematics and Probability Theory",
    department: "Computer Science",
    units: 4,
    description:
      "Logic and proofs, induction, modular arithmetic and cryptography basics, graphs, counting, and an introduction to discrete probability.",
    prereqExpr: null,
  },
  {
    code: "CS170",
    displayCode: "CS 170",
    title: "Efficient Algorithms and Intractable Problems",
    department: "Computer Science",
    units: 4,
    description:
      "Design and analysis of algorithms: divide and conquer, graph algorithms, greedy methods, dynamic programming, and an introduction to NP-completeness.",
    prereqExpr: and(course("CS61B"), course("CS70")),
  },
  {
    code: "CS186",
    displayCode: "CS 186",
    title: "Introduction to Database Systems",
    department: "Computer Science",
    units: 4,
    description:
      "Database system internals: storage, indexing, query processing and optimization, transactions, and concurrency control, plus a substantial systems-building project.",
    prereqExpr: and(course("CS61B"), course("CS61C")),
  },
  {
    code: "CS188",
    displayCode: "CS 188",
    title: "Introduction to Artificial Intelligence",
    department: "Computer Science",
    units: 4,
    description:
      "Search, game playing, constraint satisfaction, Markov decision processes, reinforcement learning, Bayesian networks, and an introduction to machine learning.",
    prereqExpr: and(or(course("CS61A"), course("CS61B")), course("CS70")),
  },
  {
    code: "CS189",
    displayCode: "CS 189",
    title: "Introduction to Machine Learning",
    department: "Computer Science",
    units: 4,
    description:
      "Theoretical foundations and practical algorithms for supervised and unsupervised learning: regression, classification, neural networks, clustering, and dimensionality reduction.",
    prereqExpr: and(
      course("CS61B"),
      course("CS70"),
      course("MATH53"),
      or(course("MATH54"), course("EECS16A"))
    ),
  },
  {
    code: "CS161",
    displayCode: "CS 161",
    title: "Computer Security",
    department: "Computer Science",
    units: 4,
    description:
      "Principles of computer security: cryptography fundamentals, memory-safety vulnerabilities and exploits, web security, and network attacks.",
    prereqExpr: and(course("CS61B"), course("CS70"), course("CS61C")),
  },
  {
    code: "CS162",
    displayCode: "CS 162",
    title: "Operating Systems and System Programming",
    department: "Computer Science",
    units: 4,
    description:
      "Operating system design: processes and threads, synchronization, scheduling, memory management, file systems, and distributed systems, built around large C projects.",
    prereqExpr: and(
      course("CS61A"),
      course("CS61B"),
      course("CS61C"),
      course("CS70")
    ),
  },
  {
    code: "CS168",
    displayCode: "CS 168",
    title: "Introduction to the Internet: Architecture and Protocols",
    department: "Computer Science",
    units: 4,
    description:
      "How the Internet works: routing, transport protocols, congestion control, and the design philosophy behind a network built from unreliable parts.",
    prereqExpr: and(course("CS61B"), course("CS61C")),
  },
  {
    code: "DATA100",
    displayCode: "Data 100",
    title: "Principles and Techniques of Data Science",
    department: "Data Science",
    units: 4,
    description:
      "The data science lifecycle: data wrangling, exploratory analysis, visualization, statistical inference, and an introduction to modeling and machine learning.",
    prereqExpr: and(
      or(course("CS61A"), course("CS88")),
      or(course("MATH54"), course("EECS16A"))
    ),
  },
];
