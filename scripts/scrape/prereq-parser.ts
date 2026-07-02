/**
 * Prerequisite text parser
 * ========================
 * Converts Berkeley's free-text prereq strings into our typed PrereqExpr tree.
 *
 * Handles:
 *  "COMPSCI 61A, COMPSCI 88, or ENGIN 7"       → OR(CS61A, CS88, ENGIN7)
 *  "COMPSCI 61B and COMPSCI 70"                  → AND(CS61B, CS70)
 *  "COMPSCI 61A, COMPSCI 61B, and COMPSCI 70"   → AND(CS61A, CS61B, CS70)
 *  "(COMPSCI 61A or COMPSCI 61B) and COMPSCI 70" → AND(OR(CS61A,CS61B), CS70)
 *  "COMPSCI 61B and (MATH 54 or EECS 16A)"       → AND(CS61B, OR(MATH54,EECS16A))
 *  "COMPSCI 61A with a grade of B- or better, or COMPSCI 88" → OR(CS61A, CS88)
 *  "COMPSCI 61B or consent of instructor"         → COURSE(CS61B)
 */

import type { PrereqExpr } from "../../lib/types";

// Dept name as it appears in prereq text → our internal prefix.
// Includes BOTH abbreviations ("COMPSCI") and full names ("Computer Science")
// because the EECS site uses both styles on different pages.
const DEPT_MAP: Record<string, string> = {
  // CS / EE / EECS
  COMPSCI: "CS",
  EECS: "EECS",
  EE: "EE",
  ELENG: "EE",
  "EL ENG": "EE",
  // Math / Stats / Data
  MATH: "MATH",
  STAT: "STAT",
  DATASCI: "DATA",
  DATA: "DATA",
  // Engineering departments
  ENGIN: "ENGIN",
  AEROENG: "AEROENG",
  "AERO ENG": "AEROENG",
  BIOENG: "BIOE",
  "BIO ENG": "BIOE",
  CIVENG: "CEE",
  "CIV ENG": "CEE",
  INDENG: "IEOR",
  "IND ENG": "IEOR",
  IEOR: "IEOR",
  MATSCI: "MSE",
  "MAT SCI": "MSE",
  MSE: "MSE",
  MECENG: "ME",
  "MEC ENG": "ME",
  "MECH ENG": "ME",
  ME: "ME",
  NUCENG: "NE",
  "NUC ENG": "NE",
  NE: "NE",
  CEE: "CEE",
  BIOE: "BIOE",
  // Sciences
  PHYSICS: "PHYS",
  PHYS: "PHYS",
  CHEM: "CHEM",
  BIO: "BIO",
  MCB: "MCB",
  // Full names (used on some pages)
  "COMPUTER SCIENCE": "CS",
  "ELECTRICAL ENGINEERING": "EE",
  MATHEMATICS: "MATH",
  ENGINEERING: "ENGIN",
  STATISTICS: "STAT",
  CHEMISTRY: "CHEM",
  BIOLOGY: "BIO",
};

// Sort longest-first so multi-word names match before their sub-strings
// (e.g. "ELECTRICAL ENGINEERING" before "EE").
const DEPT_ALT = Object.keys(DEPT_MAP)
  .sort((a, b) => b.length - a.length)
  .join("|");

const COURSE_RE = new RegExp(
  `\\b(${DEPT_ALT})\\s+([A-Z]?\\d+[A-Z]{0,2}(?:\\d+[A-Z]{0,2})?)\\b`,
  "gi"
);

// Phrases to strip before parsing
const STRIP_PATTERNS: RegExp[] = [
  /with a grade of [A-Z][+-]? or better/gi,
  /or equivalent/gi,
  /or consent of instructor/gi,
  /or permission of instructor/gi,
  /or instructor[''']?s? permission/gi,
  /or instructor[''']?s? consent/gi,
  /\(concurrent enrollment (?:is )?(?:also )?allowed\)/gi,
  /may be taken concurrently\b[^.;]*/gi,
  /must be taken concurrently with \S+/gi,
  /\bor higher\b/gi,
  /\bsenior standing\b/gi,
  /\bjunior standing\b/gi,
  /\bsophomore standing\b/gi,
  // Common on EECS pages when bare numbers are used:
  /,?\s*or programming experience equivalent to that gained in[^.;]*/gi,
  /,?\s*or equivalent programming experience[^.;]*/gi,
];

// Normalise non-standard conjunctions BEFORE parsing so the
// core AND/OR logic can handle them uniformly.
function normalizeConjunctions(text: string): string {
  return text
    // "along with (either)" → "and" — e.g. "61A, along with either 61B or 61BL"
    .replace(/,?\s*along with(?:\s+either)?\s+/gi, " and ")
    // "as well as" → "and"
    .replace(/,?\s*as well as\s+/gi, " and ")
    // "either X or Y" at start → just keep "X or Y" (either is implied)
    .replace(/\beither\s+/gi, "");
}

export function normalizeCode(dept: string, num: string): string {
  const prefix = DEPT_MAP[dept.toUpperCase()] ?? dept.toUpperCase();
  return `${prefix}${num.replace(/\s+/g, "").toUpperCase()}`;
}

/** Pull the first course code out of a short text fragment. */
function extractOne(text: string): string | null {
  COURSE_RE.lastIndex = 0;
  const m = COURSE_RE.exec(text);
  return m ? normalizeCode(m[1], m[2]) : null;
}

/** Pull ALL course codes out of a text, in order. */
function extractAll(text: string): string[] {
  const codes: string[] = [];
  COURSE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COURSE_RE.exec(text)) !== null) {
    codes.push(normalizeCode(m[1], m[2]));
  }
  return codes;
}

function hasAnyCourse(text: string): boolean {
  COURSE_RE.lastIndex = 0;
  return COURSE_RE.test(text);
}

/** Strip outermost matching parentheses if the whole string is wrapped. */
function stripOuterParens(s: string): string {
  s = s.trim();
  if (!s.startsWith("(") || !s.endsWith(")")) return s;
  let d = 0;
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === "(") d++;
    else if (s[i] === ")") d--;
    if (d === 0) return s; // closes before the end
  }
  return s.slice(1, -1).trim();
}

/**
 * Split a string by ` <conj> ` at depth 0 (not inside parens).
 * Returns [] if the conjunction never appears at depth 0.
 */
function topSplit(text: string, conj: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  const needle = ` ${conj} `;
  const lo = text.toLowerCase();

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;

    if (depth === 0 && lo.slice(i, i + needle.length) === needle) {
      parts.push(cur.trim());
      cur = "";
      i += needle.length - 1;
    } else {
      cur += text[i];
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.length > 1 ? parts : [];
}

/**
 * Given a text fragment (one branch after a top-level AND/OR split), extract
 * all PrereqExprs it contains. Handles:
 *  - single course:              "COMPSCI 61A"
 *  - paren sub-expr:             "(COMPSCI 61A or COMPSCI 61B)"
 *  - OR branch inside AND:       "COMPSCI 61B or COMPSCI 61BL"  ← key case
 *  - comma list:                 "COMPSCI 61A, COMPSCI 88,"
 */
function extractNodes(text: string): PrereqExpr[] {
  text = text.replace(/,\s*$/, "").trim();
  if (!text) return [];

  // Parenthesized sub-expression → recurse fully
  if (text.startsWith("(")) {
    const inner = parse(stripOuterParens(text));
    return inner ? [inner] : [];
  }

  // If the branch itself has a top-level OR (e.g. "61B or 61BL" inside an AND),
  // recurse so it becomes an OR node rather than just picking the first course.
  if (topSplit(text, "or").length > 1) {
    const inner = parse(text);
    return inner ? [inner] : [];
  }

  // Comma-separated list: "COMPSCI 61A, COMPSCI 88"
  const commaSegments = text.split(/,\s+/).map((s) => s.trim()).filter(Boolean);
  if (commaSegments.length > 1) {
    return commaSegments
      .map((seg) => {
        if (seg.startsWith("(")) return parse(stripOuterParens(seg));
        const code = extractOne(seg);
        return code ? ({ type: "COURSE" as const, code } as PrereqExpr) : null;
      })
      .filter(Boolean) as PrereqExpr[];
  }

  // Single item
  const code = extractOne(text);
  return code ? [{ type: "COURSE" as const, code }] : [];
}

/** Core recursive parser. */
function parse(text: string): PrereqExpr | null {
  text = stripOuterParens(text).trim();
  if (!text || !hasAnyCourse(text)) return null;

  // Top-level AND split
  const andBranches = topSplit(text, "and");
  if (andBranches.length > 1) {
    const items = andBranches.flatMap(extractNodes);
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];
    return { type: "AND", items };
  }

  // Top-level OR split
  const orBranches = topSplit(text, "or");
  if (orBranches.length > 1) {
    const items = orBranches.flatMap(extractNodes);
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];
    return { type: "OR", items };
  }

  // No top-level conjunction — might be comma list or single
  const nodes = extractNodes(text);
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  // A bare comma list with no conjunction is ambiguous; treat as AND
  // (e.g. "COMPSCI 61A, COMPSCI 61B" with no "and" or "or")
  return { type: "AND", items: nodes };
}

// Matches bare course numbers with no department prefix, e.g. "61A", "70", "16B"
// Used as a fallback when the full dept name is omitted (common on EECS pages)
const BARE_NUM_RE = /\b(\d{1,3}[A-Z]{0,2}\d?[A-Z]?)\b/g;

/**
 * Expand bare numbers like "61A" → "CS 61A" using a default department.
 * Only runs when no dept-prefixed courses are found in the text at all,
 * avoiding double-processing strings that already use full names.
 */
function expandBareNumbers(text: string, defaultDept: string): string {
  COURSE_RE.lastIndex = 0;
  if (COURSE_RE.test(text)) return text; // already has proper course references
  BARE_NUM_RE.lastIndex = 0;
  return text.replace(BARE_NUM_RE, `${defaultDept} $1`);
}

/**
 * Parse a raw Berkeley prerequisite string into a typed boolean expression.
 * Returns null expr if no recognizable course codes are found.
 *
 * @param defaultDept - Department prefix to use when the prereq text uses bare
 *   numbers ("61A") instead of full names ("Computer Science 61A"). Pass the
 *   subject being scraped, e.g. "COMPSCI" for CS pages, "EE" for EE pages.
 */
export function parsePrereqs(
  raw: string | null | undefined,
  defaultDept = "COMPSCI"
): {
  expr: PrereqExpr | null;
  raw: string | null;
} {
  if (!raw?.trim()) return { expr: null, raw: null };

  let text = raw
    .trim()
    .replace(/;/g, ",") // treat semicolons as commas
    .replace(/\.$/, "")
    .replace(/\s+/g, " ")
    .trim();

  for (const pat of STRIP_PATTERNS) {
    text = text.replace(pat, "");
  }
  text = normalizeConjunctions(text).trim().replace(/\s+/g, " ");

  // Expand bare numbers ("61A") → full refs ("COMPSCI 61A") if needed
  text = expandBareNumbers(text, defaultDept);

  if (!hasAnyCourse(text)) return { expr: null, raw: null };

  const expr = parse(text);
  return { expr, raw: raw.trim() };
}
