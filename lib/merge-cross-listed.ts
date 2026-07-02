/**
 * Cross-listing canonicalization
 * ===============================
 * Berkeley cross-lists courses under multiple departments (CHEM C146 =
 * NUC ENG C146; MEC ENG C85 = CIV ENG C30). In PeopleSoft these share a
 * 6-digit course family ID; the per-subject versions differ only in the
 * final "offer number" digit of the courseGroupId (e.g. 1155122 vs 1155121).
 *
 * We saved the courseGroupId inside catalogUrl, so at seed time we:
 *   1. Group courses by family (first 6 digits of the groupId).
 *   2. Pick one canonical version per family (preferring the user's target
 *      departments), merge the best data from all versions, and note the
 *      alternate codes in the description.
 *   3. Rewrite every prerequisite expression so references to any alias
 *      point at the canonical code — otherwise "MECENG C85 or CIVENG C30"
 *      would be two different graph nodes and prereq checking would miss.
 *
 * A static alias table handles cross-listed codes whose partner departments
 * we didn't scrape (DATA C8 lives in our data as STAT C8, etc.).
 */

import type { PrereqExpr, CourseRecord } from "../lib/types";

/** Preference order when choosing the canonical version of a family. */
const DEPT_PRIORITY = [
  "CS", "EECS", "EE", "DATA", "STAT", "MATH",
  "ME", "CEE", "BIOE", "IEOR", "MSE", "NE", "AEROENG", "ENGIN",
  "PHYS", "CHEM",
];

/**
 * Cross-subject aliases for departments we didn't scrape. Anything in a
 * prereq expression matching a key is rewritten to the value (which IS in
 * our dataset).
 */
const STATIC_ALIASES: Record<string, string> = {
  DATAC8: "STATC8",
  INFOC8: "STATC8",
  CSC8: "STATC8",
  DATAC100: "STATC100",
  CSC100: "STATC100",
  DATAC140: "STATC140",
  DATAC102: "STATC102",
  DATAC88C: "STATC88S", // closest scraped equivalent
  DATA8: "STATC8",
  DATA100: "STATC100",
  // Prefix mismatches: prereq text names a cross-listing that resolves to a
  // differently-prefixed canonical node
  EECSC106A: "MEC106A",
  EEC128: "EECSC128",
  ME136: "MEC136",
  // Legacy / renamed courses still referenced in prereq text
  EE40: "EE16B",      // EE 40 discontinued; 16B is the successor circuits course
  STAT101: "STAT134", // old numbering, appears only as an OR-partner of 134
  CHEM3: "CHEM3A",    // "CHEM 3" refers to the 3A/3B series
  CSC88C: "CS88",     // COMPSCI C88C is the renumbered CS 88 (hand-curated node)
  STAT140: "STAT134", // appears only as an OR-partner of STAT 134
};

interface MergeInput extends CourseRecord {
  catalogUrl?: string;
}

function familyId(catalogUrl?: string): string | null {
  const m = catalogUrl?.match(/courses\/(\d{7,})/);
  if (!m) return null;
  return m[1].slice(0, 6);
}

function deptRank(code: string): number {
  for (let i = 0; i < DEPT_PRIORITY.length; i++) {
    if (code.startsWith(DEPT_PRIORITY[i])) return i;
  }
  return DEPT_PRIORITY.length;
}

function rewriteExpr(
  expr: PrereqExpr | null,
  aliases: Map<string, string>
): PrereqExpr | null {
  if (!expr) return null;
  if (expr.type === "COURSE") {
    const canonical = aliases.get(expr.code);
    return canonical ? { type: "COURSE", code: canonical } : expr;
  }
  // Rewrite children, then dedupe (aliasing can turn "A or B" into "A or A")
  const items = expr.items.map((i) => rewriteExpr(i, aliases)!);
  const seen = new Set<string>();
  const deduped = items.filter((i) => {
    const key = JSON.stringify(i);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Collapse single-child AND/OR to the child itself
  if (deduped.length === 1) return deduped[0];
  return { type: expr.type, items: deduped };
}

/**
 * Merge cross-listed courses in place. Returns stats for logging.
 */
export function mergeCrossListed(
  merged: Map<string, MergeInput>
): { families: number; aliased: number } {
  // 1. Group by family
  const families = new Map<string, MergeInput[]>();
  for (const course of merged.values()) {
    const fam = familyId(course.catalogUrl);
    if (!fam) continue;
    if (!families.has(fam)) families.set(fam, []);
    families.get(fam)!.push(course);
  }

  // 2. Build the alias map (starts from the static table)
  const aliases = new Map<string, string>(Object.entries(STATIC_ALIASES));
  let familyCount = 0;

  for (const allMembers of families.values()) {
    if (allMembers.length < 2) continue;
    // Safety guard: cross-listed versions of a course share the same title.
    // Only merge members whose titles match — prevents false merges if two
    // unrelated courses ever shared a group-ID prefix.
    const byTitle = new Map<string, MergeInput[]>();
    for (const m of allMembers) {
      const t = (m.title ?? "").toLowerCase().trim();
      if (!byTitle.has(t)) byTitle.set(t, []);
      byTitle.get(t)!.push(m);
    }
    for (const members of byTitle.values()) {
    if (members.length < 2) continue;
    familyCount++;

    // Pick canonical: preferred department, then shortest code
    const sorted = [...members].sort(
      (a, b) => deptRank(a.code) - deptRank(b.code) || a.code.length - b.code.length
    );
    const canonical = sorted[0];
    const others = sorted.slice(1);

    // Merge: keep the richest prereq data and note alternates
    const countCourses = (e: PrereqExpr | null): number => {
      if (!e) return 0;
      if (e.type === "COURSE") return 1;
      return e.items.reduce((n, i) => n + countCourses(i), 0);
    };
    for (const o of others) {
      if (countCourses(o.prereqExpr) > countCourses(canonical.prereqExpr)) {
        canonical.prereqExpr = o.prereqExpr;
      }
      if ((o.description?.length ?? 0) > (canonical.description?.length ?? 0)) {
        canonical.description = o.description;
      }
      aliases.set(o.code, canonical.code);
      merged.delete(o.code);
    }

    const altCodes = others.map((o) => o.displayCode).join(", ");
    if (altCodes) {
      canonical.description = `${canonical.description ?? ""}\n\nAlso listed as: ${altCodes}.`.trim();
    }
    }
  }

  // 3. Rewrite all prereq expressions through the alias map
  for (const course of merged.values()) {
    course.prereqExpr = rewriteExpr(course.prereqExpr, aliases);
  }

  return { families: familyCount, aliased: aliases.size };
}
