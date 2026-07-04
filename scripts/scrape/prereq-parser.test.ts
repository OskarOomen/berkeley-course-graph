import { describe, it, expect } from "vitest";
import { parsePrereqs, normalizeCode } from "./prereq-parser";

const expr = (text: string, dept = "COMPSCI") => parsePrereqs(text, dept).expr;
const course = (code: string) => ({ type: "COURSE", code });

describe("prereq parser: basic conjunctions", () => {
  it("parses a single course", () => {
    expect(expr("COMPSCI 61A")).toEqual(course("CS61A"));
  });

  it("parses an AND", () => {
    expect(expr("COMPSCI 61B and COMPSCI 70")).toEqual({
      type: "AND",
      items: [course("CS61B"), course("CS70")],
    });
  });

  it("parses an OR", () => {
    expect(expr("COMPSCI 61A or COMPSCI 61B")).toEqual({
      type: "OR",
      items: [course("CS61A"), course("CS61B")],
    });
  });

  it("treats a comma list with 'and' as one AND", () => {
    expect(expr("COMPSCI 61A, COMPSCI 61B, and COMPSCI 70")).toEqual({
      type: "AND",
      items: [course("CS61A"), course("CS61B"), course("CS70")],
    });
  });
});

describe("prereq parser: precedence and parens", () => {
  it("AND binds loosest: parenthesized OR inside AND", () => {
    expect(expr("(COMPSCI 61A or COMPSCI 61B) and COMPSCI 70")).toEqual({
      type: "AND",
      items: [
        { type: "OR", items: [course("CS61A"), course("CS61B")] },
        course("CS70"),
      ],
    });
  });

  it("handles parens on the right side", () => {
    expect(expr("COMPSCI 61B and (MATH 54 or EECS 16A)")).toEqual({
      type: "AND",
      items: [
        course("CS61B"),
        { type: "OR", items: [course("MATH54"), course("EECS16A")] },
      ],
    });
  });

  it("splits unparenthesized 'X or Y and Z' with AND at the root", () => {
    expect(expr("COMPSCI 61A or COMPSCI 61B and COMPSCI 70")).toEqual({
      type: "AND",
      items: [
        { type: "OR", items: [course("CS61A"), course("CS61B")] },
        course("CS70"),
      ],
    });
  });
});

describe("prereq parser: noise stripping", () => {
  it("strips grade requirements", () => {
    expect(expr("COMPSCI 61A with a grade of B- or better, or COMPSCI 88")).toEqual({
      type: "OR",
      items: [course("CS61A"), course("CS88")],
    });
  });

  it("strips 'or consent of instructor'", () => {
    expect(expr("COMPSCI 61B or consent of instructor")).toEqual(course("CS61B"));
  });

  it("returns null for pure-noise prereqs", () => {
    expect(expr("Consent of instructor")).toBeNull();
  });
});

describe("prereq parser: normalization", () => {
  it("expands bare numbers using the default department", () => {
    expect(expr("61A or 61B")).toEqual({
      type: "OR",
      items: [course("CS61A"), course("CS61B")],
    });
  });

  it("normalizes department name variants", () => {
    expect(normalizeCode("Computer Science", "61A")).toBe("CS61A");
    expect(normalizeCode("EL ENG", "16A")).toBe("EE16A");
  });

  it("parses the real MATH 104 override text", () => {
    expect(expr("MATH 53, MATH 54, and MATH 55", "MATH")).toEqual({
      type: "AND",
      items: [course("MATH53"), course("MATH54"), course("MATH55")],
    });
  });
});