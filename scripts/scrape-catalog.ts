/**
 * Berkeley Full Catalog Scraper
 * ==============================
 * Uses the Coursedog API to get all courses, then fetches individual
 * catalog pages for prerequisite data.
 *
 * Run: npm run scrape:catalog
 * Resumes from checkpoint if interrupted
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import * as cheerio from "cheerio";
import { parsePrereqs } from "./scrape/prereq-parser";
import type { PrereqExpr } from "../lib/types";


const CATALOG_ID = "hMSTjIplK6VX5nnJn7ZE";
const API_BASE = "https://app.coursedog.com/api/v1/cm/ucberkeley_peoplesoft";
const CATALOG_BASE = "https://undergraduate.catalog.berkeley.edu";
const PAGE_DELAY_MS = 300;
const API_BATCH = 500;
const INCLUDE_SUBJECTS: string[] = [
  // CDSS
  "COMPSCI", "DATASCI", "STAT",
  // Math
  "MATH",
  // CoE
  "AEROENG", "BIOENG", "CIVENG", "CIV ENG",
  "EECS", "EE", "ELENG",
  "INDENG", "IND ENG",
  "MATSCI", "MAT SCI",
  "MECENG", "MEC ENG",
  "NUCENG", "NUC ENG",
  "ENGIN",
  // Common prereq-providing depts (physics, chem often required for CoE)
  "PHYSICS", "CHEM",
];


interface CoursedogCourse {
  id: string;
  courseGroupId: string;
  name: string;
  longName?: string;
  subjectCode: string;
  courseNumber: string;
  code: string;
  displayName?: string;
  description?: string;
  credits?: { creditHours?: { min?: number; max?: number } };
  college?: string;
  department?: string;
  career?: string;
  status: string;
}

interface ApiResponse {
  courses: CoursedogCourse[];
  totalCount: number;
}

export interface ScrapedCourse {
  code: string;
  displayCode: string;
  title: string;
  department: string;
  college: string;
  units: number | null;
  description: string;
  prereqExpr: PrereqExpr | null;
  prereqRaw: string | null;
  catalogUrl: string;
  subjectCode: string;
}


function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseUnits(credits?: CoursedogCourse["credits"]): number | null {
  const min = credits?.creditHours?.min;
  if (min != null) return Math.round(min);
  return null;
}

function normalizeCode(subjectCode: string, courseNumber: string): string {
  const DEPT_MAP: Record<string, string> = {
    COMPSCI: "CS", EECS: "EECS", ELENG: "EE", MATH: "MATH", STAT: "STAT",
    DATASCI: "DATA", ENGIN: "ENGIN", PHYSICS: "PHYS", PHYS: "PHYS",
    CHEM: "CHEM", BIOLOGY: "BIO", MCB: "MCB", INDENG: "IEOR",
    BIOENG: "BIOE", MECENG: "ME", MATSCI: "MSE", NUCENG: "NE",
    CIVENG: "CEE", "CIV ENG": "CEE", "MEC ENG": "ME", "MAT SCI": "MSE",
    "NUC ENG": "NE",
  };
  const prefix = DEPT_MAP[subjectCode] ?? subjectCode.replace(/\s+/g, "");
  return `${prefix}${courseNumber.replace(/\s+/g, "")}`;
}


async function fetchWithRetry(fn: () => Promise<Response>, retries = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fn();
    if (res.ok) return res;
    if ([429, 502, 503].includes(res.status)) {
      const wait = 2000 * Math.pow(2, i);
      console.log(`  [${res.status}] retrying in ${wait / 1000}s...`);
      await sleep(wait);
      continue;
    }
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  throw new Error("Max retries exceeded");
}

async function fetchCoursePage(skip: number, limit: number): Promise<ApiResponse> {
  const params = new URLSearchParams({
    catalogId: CATALOG_ID, skip: String(skip), limit: String(limit),
    orderBy: "subjectCode", formatDependents: "false",
    effectiveDatesRange: "2027-05-24,2027-05-24",
    ignoreEffectiveDating: "false", ignoreTotalCount: "false",
    columns: "id,courseGroupId,displayName,name,courseNumber,subjectCode,code,description,credits,college,department,career,status",
  });

  const res = await fetchWithRetry(() =>
    fetch(`${API_BASE}/courses/search/%24filters?${params}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
        "origin": "https://undergraduate.catalog.berkeley.edu",
        "referer": "https://undergraduate.catalog.berkeley.edu/",
        "x-requested-with": "catalog",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        condition: "AND",
        filters: [{
          condition: "and", id: "main",
          filters: [
            { id: "status-course", condition: "field", name: "status", inputType: "select", group: "course", type: "is", value: "Active", customField: false },
            { id: "departments-course", condition: "field", name: "departments", inputType: "select", group: "course", type: "doesNotContain", value: ["LAW"], customField: false },
            { id: "departments-course", condition: "field", name: "departments", inputType: "select", group: "course", type: "doesNotContain", value: ["NONUCB"], customField: false },
            { id: "departments-course", condition: "field", name: "departments", inputType: "select", group: "course", type: "doesNotContain", value: ["UCEAP"], customField: false },
            { id: "catalogPrint-course", condition: "field", name: "catalogPrint", inputType: "boolean", group: "course", type: "is", value: true, customField: false },
            { id: "courseApproved-course", condition: "field", name: "courseApproved", inputType: "select", group: "course", type: "is", value: "Approved", customField: false },
          ],
        }],
      }),
    })
  );

  const json = await res.json();
  return { courses: json.data ?? [], totalCount: json.listLength ?? 0 };
}

async function fetchAllCourses(): Promise<CoursedogCourse[]> {
  console.log("Fetching course list from Coursedog API...");
  const first = await fetchCoursePage(0, API_BATCH);
  const total = first.totalCount;
  console.log(`Total courses in catalog: ${total}`);

  const all: CoursedogCourse[] = [...first.courses];
  let skip = API_BATCH;
  while (skip < total) {
    await sleep(200);
    const batch = await fetchCoursePage(skip, API_BATCH);
    all.push(...batch.courses);
    skip += API_BATCH;
    console.log(`  Fetched ${Math.min(skip, total)}/${total}`);
  }
  return all;
}


async function fetchCatalogPage(course: CoursedogCourse): Promise<string | null> {
  // Use the plain course page — NO /overview suffix
  // /courses/{courseGroupId} returns simple server-rendered HTML with a clean
  // "### Prerequisites" section. /courses/{id}/overview returns the Coursedog
  // UI shell which is harder to parse
  const url = `${CATALOG_BASE}/courses/${course.courseGroupId}`;

  let html = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    if (res.ok) { html = await res.text(); break; }
    if (res.status === 404) return null;
    await sleep(1000 * (attempt + 1));
  }
  if (!html) return null;

  const $ = cheerio.load(html);

  $("h1,h2,h3,h4,h5,h6,p,div,dt,dd,li,span,section,td,th,label").each((_i, el) => {
    $(el).append("\n");
  });

  const lines = $("body")
    .text()
    .split(/\n/)
    .map((l: string) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let prereqText: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (!/^prerequisites?:?$/i.test(lines[i])) continue;

    const parts: string[] = [];
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const line = lines[j];
      if (
        /^(repeat rules|credit restriction|credit repla|grading|method of|format|instructors|units|term|weeks|hours|outside work|prior terms|subject|course number|department|course level|course title|course description|american cultures|reading and composition|corequisite)/i.test(line)
      ) break;
      if (/^complete\s+(all|any|one)\s+of/i.test(line)) break;
      // Skip "Requirement 1" / "Requirement 2" sub-labels but keep collecting
      if (/^requirement\s*\d*$/i.test(line)) continue;
      parts.push(line);
    }

    const joined = parts.join(" ").replace(/\s+/g, " ").replace(/\.$/, "").trim();
    if (joined.length > 2 && /\d/.test(joined)) {
      prereqText = joined;
      break; // found real content — stop
    }
    // Nothing useful at this label (e.g. a nav/TOC entry) — keep scanning
    // for the next "Prerequisite" occurrence instead of giving up.
  }

  return prereqText && prereqText.length > 2 ? prereqText : null;
}

const CHECKPOINT_PATH = join(process.cwd(), "data", "scraped", "catalog-checkpoint.json");

function saveCheckpoint(results: ScrapedCourse[]) {
  mkdirSync(join(process.cwd(), "data", "scraped"), { recursive: true });
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(results));
}

function loadCheckpoint(): ScrapedCourse[] {
  try {
    if (existsSync(CHECKPOINT_PATH)) {
      const data = JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"));
      console.log(`Resuming from checkpoint: ${data.length} courses already done`);
      return data;
    }
  } catch {}
  return [];
}


async function main() {
  const apiCourses = await fetchAllCourses();

  const filtered = INCLUDE_SUBJECTS.length > 0
    ? apiCourses.filter((c) => INCLUDE_SUBJECTS.includes(c.subjectCode))
    : apiCourses;

  const active = filtered.filter(
    (c) => c.status === "Active" &&
      (c.career === "Undergraduate" || c.career === "UGRD" || !c.career)
  );

  console.log(`\n${active.length} active undergraduate courses to scrape`);
  console.log(`Estimated time: ~${Math.ceil((active.length * PAGE_DELAY_MS) / 60000)} minutes\n`);

  const checkpoint = loadCheckpoint();
  const doneCodes = new Set(checkpoint.map((c) => c.code));
  const results: ScrapedCourse[] = [...checkpoint];
  const remaining = active.filter(
    (c) => !doneCodes.has(normalizeCode(c.subjectCode, c.courseNumber))
  );
  console.log(`${remaining.length} remaining after checkpoint\n`);

  let i = checkpoint.length;

  for (const course of remaining) {
    i++;
    await sleep(PAGE_DELAY_MS);

    try {
      const prereqRaw = await fetchCatalogPage(course);
      const { expr: prereqExpr, raw: cleanRaw } = parsePrereqs(prereqRaw, course.subjectCode);

      const scraped: ScrapedCourse = {
        code: normalizeCode(course.subjectCode, course.courseNumber),
        displayCode: course.displayName ?? `${course.subjectCode} ${course.courseNumber}`,
        title: course.longName ?? course.name,
        department: course.department ?? course.subjectCode,
        college: course.college ?? "",
        units: parseUnits(course.credits),
        description: course.description ?? "",
        prereqExpr,
        prereqRaw: cleanRaw,
        catalogUrl: `${CATALOG_BASE}/courses/${course.courseGroupId}/overview`,
        subjectCode: course.subjectCode,
      };

      results.push(scraped);
      console.log(`  [${i}/${active.length}] ${scraped.displayCode} — prereq: ${cleanRaw ?? "none"}`);

      // Save checkpoint every 100 courses
      if (results.length % 100 === 0) {
        saveCheckpoint(results);
        console.log(`  >>> checkpoint saved (${results.length} total)`);
      }
    } catch (err) {
      console.error(`  ✗ ${course.code}: ${(err as Error).message}`);
    }
  }

  const outDir = join(process.cwd(), "data", "scraped");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "catalog.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  try { unlinkSync(CHECKPOINT_PATH); } catch {}

  const withPrereqs = results.filter((c) => c.prereqExpr !== null);
  const bySubject = new Map<string, number>();
  for (const c of results) bySubject.set(c.subjectCode, (bySubject.get(c.subjectCode) ?? 0) + 1);

  console.log(`\n✓ Done. Written to ${outPath}`);
  console.log(`  ${results.length} courses, ${withPrereqs.length} with prerequisites`);
  console.log(`\nTop departments:`);
  [...bySubject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([d, n]) => console.log(`  ${d}: ${n}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
