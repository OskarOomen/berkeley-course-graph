/**
 * Seed from scraped data
 * ======================
 * Priority order:
 *   1. data/scraped/catalog.json  (full Berkeley catalog — from scrape:catalog)
 *   2. data/scraped/eecs.json     (EECS-only — from scrape)
 *   3. data/seed-courses.ts       (hand-curated fallback)
 */

import { db, ensureSchema } from "../lib/db";
import { seedCourses } from "../data/seed-courses";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CourseRecord } from "../lib/types";
import { PREREQ_OVERRIDES } from "../data/prereq-overrides";
import { parsePrereqs } from "./scrape/prereq-parser";
import { mergeCrossListed } from "../lib/merge-cross-listed";
import { buildGraph, findCycle } from "../lib/graph";
import type { PrereqExpr } from "../lib/types";

function toRecord(c: any): CourseRecord & { catalogUrl?: string } {
  return {
    code: c.code,
    displayCode: c.displayCode,
    title: c.title,
    department: c.department,
    units: c.units ?? 4,
    description: c.description,
    prereqExpr: c.prereqExpr,
    catalogUrl: c.catalogUrl, // used for cross-listing merge, not stored
  };
}

async function upsertCourse(c: CourseRecord) {
  await db.execute({
    sql: `
      INSERT INTO courses (code, display_code, title, department, units, description, prereq_expr)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        display_code = excluded.display_code,
        title        = excluded.title,
        department   = excluded.department,
        units        = excluded.units,
        description  = excluded.description,
        prereq_expr  = excluded.prereq_expr
    `,
    args: [
      c.code,
      c.displayCode,
      c.title,
      c.department,
      c.units,
      c.description,
      c.prereqExpr ? JSON.stringify(c.prereqExpr) : null,
    ],
  });
}

async function main() {
  await ensureSchema();

  // Hand-curated fallback
  const handCurated: CourseRecord[] = seedCourses.map((c) => ({
    code: c.code,
    displayCode: c.displayCode,
    title: c.title,
    department: c.department,
    units: c.units,
    description: c.description,
    prereqExpr: c.prereqExpr,
  }));

  const catalogPath = join(process.cwd(), "data", "scraped", "catalog.json");
  const eecsPath    = join(process.cwd(), "data", "scraped", "eecs.json");

  let scraped: CourseRecord[] = [];

  if (existsSync(catalogPath)) {
    const raw = JSON.parse(readFileSync(catalogPath, "utf8")) as any[];
    scraped = raw.map(toRecord);
    console.log(`Loaded ${scraped.length} courses from full catalog scrape`);
  } else if (existsSync(eecsPath)) {
    const raw = JSON.parse(readFileSync(eecsPath, "utf8")) as any[];
    scraped = raw.map(toRecord);
    console.log(`Loaded ${scraped.length} EECS courses`);
  } else {
    console.log("No scraped data found — using hand-curated data only.");
    console.log("Run `npm run scrape:catalog` for the full Berkeley catalog.");
  }

  // Scraped takes precedence over hand-curated
  const merged = new Map<string, CourseRecord>();
  for (const c of handCurated) merged.set(c.code, c);
  for (const c of scraped)     merged.set(c.code, c);

  // Apply manual prereq overrides (verified corrections for courses the
  // scraper gets wrong)
  let overridden = 0;
  for (const [code, rawText] of Object.entries(PREREQ_OVERRIDES)) {
    const existing = merged.get(code);
    if (!existing) continue;
    const { expr } = parsePrereqs(rawText, code.replace(/[0-9].*$/, ""));
    merged.set(code, { ...existing, prereqExpr: expr });
    overridden++;
  }
  if (overridden > 0) console.log(`Applied ${overridden} manual prereq overrides`);

  // Merge cross-listed courses (CHEM C146 = NUC ENG C146, etc.) into one
  // canonical node each, rewriting prereq expressions to match.
  const mergeStats = mergeCrossListed(merged as any);
  console.log(
    `Merged ${mergeStats.families} cross-listed families (${mergeStats.aliased} alias mappings)`
  );


  // A course can never be its own prerequisite. Self-references come from
  // advisory prose ("consider a course more advanced than 1A") that the
  // parser mistakes for requirements. Strip them and collapse the expression.
  function stripSelfRefs(expr: PrereqExpr | null, own: string): PrereqExpr | null {
    if (!expr) return null;
    if (expr.type === "COURSE") return expr.code === own ? null : expr;
    const items = expr.items
      .map((i) => stripSelfRefs(i, own))
      .filter((i): i is PrereqExpr => i !== null);
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];
    return { type: expr.type, items };
  }
  let selfRefs = 0;
  for (const c of merged.values()) {
    const cleaned = stripSelfRefs(c.prereqExpr, c.code);
    if (JSON.stringify(cleaned) !== JSON.stringify(c.prereqExpr)) selfRefs++;
    c.prereqExpr = cleaned;
  }
  if (selfRefs > 0) console.log(`Stripped self-references from ${selfRefs} courses`);

  // Stub nodes for heavily-referenced courses outside the scraped
  // departments, so prereq chains and planner checks resolve.
  const STUBS: CourseRecord[] = [
    {
      code: "BIO1A", displayCode: "BIOLOGY 1A", title: "General Biology Lecture",
      department: "BIOLOGY", units: 3,
      description: "General introduction to cell structure and function, molecular and organismal genetics. (Outside scraped departments — included as a prerequisite target.)",
      prereqExpr: null,
    },
    {
      code: "BIO1B", displayCode: "BIOLOGY 1B", title: "General Biology Lecture",
      department: "BIOLOGY", units: 4,
      description: "General introduction to plant development, ecology, and evolution. (Outside scraped departments — included as a prerequisite target.)",
      prereqExpr: null,
    },
  ];
  for (const stub of STUBS) if (!merged.has(stub.code)) merged.set(stub.code, stub as any);

  // Remove phantom prereq refs: the parser occasionally turns GPA thresholds
  // ("3.0 GPA" on research/H194 pages) into course codes like "ENGIN 3".
  // Rule: drop COURSE refs that don't resolve to any node AND have a bare
  // single-digit number of 5 or less — no real scraped prereq matches that.
  const nodeCodes = new Set(merged.keys());
  function dropPhantoms(expr: PrereqExpr | null): PrereqExpr | null {
    if (!expr) return null;
    if (expr.type === "COURSE") {
      // Two artifact classes: GPA thresholds ("3.0 GPA" -> "ENGIN 3") and
      // unit thresholds ("60 units completed" -> "CHEM 60")
      const phantom =
        !nodeCodes.has(expr.code) &&
        (/^[A-Z]+[1-5]$/.test(expr.code) || /^[A-Z]+(30|60|90|120)$/.test(expr.code));
      return phantom ? null : expr;
    }
    const items = expr.items.map(dropPhantoms).filter((i): i is PrereqExpr => i !== null);
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];
    return { type: expr.type, items };
  }
  let phantomFixes = 0;
  for (const c of merged.values()) {
    const cleaned = dropPhantoms(c.prereqExpr);
    if (JSON.stringify(cleaned) !== JSON.stringify(c.prereqExpr)) phantomFixes++;
    c.prereqExpr = cleaned;
  }
  if (phantomFixes > 0) console.log(`Removed phantom GPA-artifact refs from ${phantomFixes} courses`);

  const all = [...merged.values()];

  // Data-quality gate: the prereq graph must be a DAG. A cycle would mean
  // some set of courses mutually require each other — always a data error.
  const cycle = findCycle(buildGraph(all));
  if (cycle) {
    console.warn(`⚠ WARNING: prerequisite cycle detected: ${cycle.join(" -> ")}`);
    console.warn("  This indicates bad source data — inspect these courses.");
  } else {
    console.log("Cycle check passed — prerequisite graph is a DAG ✓");
  }

  console.log(`Seeding ${all.length} courses...`);
  for (const c of all) await upsertCourse(c);
  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .then(() => process.exit(0));
