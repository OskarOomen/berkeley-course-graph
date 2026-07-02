/**
 * EECS course scraper
 * ===================
 * Scrapes all CS and EE courses from www2.eecs.berkeley.edu.
 *
 * HOW IT WORKS:
 *   Step 1: Fetch the course list page (e.g. /Courses/CS/) — this gives us
 *           every course code, its title, description, and units all in one
 *           clean HTML page. No prerequisites here though.
 *   Step 2: For each course, fetch its individual page (/Courses/CS61B/) to
 *           get the Prerequisites field.
 *   Step 3: Run the prereq text through the parser to get a typed boolean
 *           expression tree.
 *   Step 4: Write the results to data/scraped/eecs.json.
 *
 * WHY EECS IS EASY:
 *   The EECS site has been maintained in the same format since at least 2010.
 *   The list pages are plain server-rendered HTML (no JavaScript required),
 *   which makes them trivially scrapeable and resilient to breakage.
 *   Prerequisites are consistently formatted under a <strong>Prerequisites:</strong>
 *   label on each course's individual page.
 *
 * RATE LIMITING:
 *   We sleep 300ms between individual course page requests. The full catalog
 *   (~160 courses) takes around 60–90 seconds. This is polite crawling — do
 *   not reduce the delay.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import * as cheerio from "cheerio";
import { parsePrereqs } from "./prereq-parser";
import type { PrereqExpr } from "../../lib/types";

const BASE = "https://www2.eecs.berkeley.edu";
const DELAY_MS = 300;

export interface ScrapedCourse {
  code: string;
  displayCode: string;
  title: string;
  department: string;
  units: number | null;
  description: string;
  prereqExpr: PrereqExpr | null;
  prereqRaw: string | null;
  sourceUrl: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Berkeley Course Graph Student Project (contact: github.com/you/course-graph)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * Scrape the course list page for a given EECS subject (CS or EE).
 * Returns an array of { displayCode, title, description, units, slug }.
 * The slug is the path component used to fetch the individual course page.
 */
async function scrapeListPage(subject: "CS" | "EE"): Promise<
  Array<{
    displayCode: string;
    title: string;
    description: string;
    units: string;
    slug: string;
  }>
> {
  const url = `${BASE}/Courses/${subject}/`;
  console.log(`  Fetching list page: ${url}`);
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const courses: Array<{
    displayCode: string;
    title: string;
    description: string;
    units: string;
    slug: string;
  }> = [];

  // Each course is an <li> element containing an <a> link and strong-labelled fields.
  // Structure (simplified):
  //   <li>
  //     <a href="/Courses/CS61B">CS 61B. Data Structures</a>
  //     <strong>Catalog Description:</strong> ...
  //     <strong>Units:</strong> 4
  //   </li>
  $("li").each((_i, el) => {
    const $el = $(el);
    const $link = $el.find("a").first();
    const href = $link.attr("href") ?? "";

    // Only process links to individual course pages (pattern: /Courses/CS61B)
    if (!href.match(/\/Courses\/[A-Z]/i)) return;

    const linkText = $link.text().trim();
    // e.g. "CS 61B. Data Structures" or "CS C8. Foundations of Data Science"
    const dotIdx = linkText.indexOf(".");
    if (dotIdx === -1) return;

    const displayCode = linkText.slice(0, dotIdx).trim();
    const title = linkText.slice(dotIdx + 1).trim();

    // Extract catalog description and units from the text nodes / strong labels
    const fullText = $el.text();
    const descMatch = fullText.match(
      /Catalog Description:\s*([\s\S]*?)(?:Units:|$)/
    );
    const unitsMatch = fullText.match(/Units:\s*([\d\-–.]+)/);

    const description = descMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const units = unitsMatch?.[1]?.trim() ?? "";

    // Slug: e.g. /Courses/CS61B → "CS61B"
    const slug = href.split("/").filter(Boolean).pop() ?? "";

    if (displayCode && title && slug) {
      courses.push({ displayCode, title, description, units, slug });
    }
  });

  return courses;
}

/**
 * Fetch an individual course page and extract the Prerequisites field.
 *
 * The EECS course pages look like this in the main content area:
 *   <strong>Prerequisites:</strong> Computer Science 61C, Electrical Engineering 40.
 *   <strong>Credit Restrictions:</strong> ...
 *
 * The prereq value is a text node immediately after the <strong> tag, inside
 * the same <p>. The most reliable extraction is:
 *   1. Get the full text of the page's #site-main content block
 *   2. Regex-match everything between "Prerequisites:" and the next label
 *
 * This avoids the cheerio text-node-sibling gotcha entirely.
 */
async function scrapeCoursePage(slug: string): Promise<string | null> {
  const url = `${BASE}/Courses/${slug}/`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  // Grab the main content text, stripping nav/header boilerplate
  const mainText = $("#site-main, main, article, .entry-content")
    .first()
    .text();
  const pageText = mainText.length > 100 ? mainText : $.text(); // fallback

  // Match "Prerequisites:" followed by value, ending at next label
  // Known labels that follow: Credit Restrictions, Formats, Grading Basis,
  // Final Exam Status, Class Schedule, Links, Also Offered As
  const NEXT_LABEL =
    /credit restrictions|grading basis|formats?:|final exam|class schedule|links:|also offered|related areas/i;

  const prereqMatch = pageText.match(
    /Prerequisites:\s*([\s\S]*?)(?=\n\s*(?:Credit|Grading|Format|Final|Class|Links|Also|Related)|$)/i
  );

  if (!prereqMatch) return null;

  let value = prereqMatch[1].trim();

  // Cut off at the next label if it somehow ended up on the same line
  const stopIdx = value.search(NEXT_LABEL);
  if (stopIdx > 0) value = value.slice(0, stopIdx).trim();

  // Collapse whitespace and remove trailing period
  value = value.replace(/\s+/g, " ").replace(/\.\s*$/, "").trim();

  return value.length > 0 ? value : null;
}

function parseDisplayCode(displayCode: string): string {
  // "CS 61B" → "CS61B", "CS C8" → "CSC8", "EE 16A" → "EE16A"
  return displayCode.replace(/\s+/g, "").toUpperCase();
}

function parseUnits(unitStr: string): number | null {
  if (!unitStr) return null;
  // "4", "1-2", "1–4", "3.0" — take the first number
  const m = unitStr.match(/[\d.]+/);
  if (!m) return null;
  return Math.round(parseFloat(m[0]));
}

function inferDepartment(subject: "CS" | "EE"): string {
  return subject === "CS" ? "Computer Science" : "Electrical Engineering";
}

export async function scrapeEECS(): Promise<ScrapedCourse[]> {
  const all: ScrapedCourse[] = [];

  for (const subject of ["CS", "EE"] as const) {
    console.log(`\nScraping ${subject} courses...`);
    const listItems = await scrapeListPage(subject);
    console.log(`  Found ${listItems.length} courses on list page`);

    for (const item of listItems) {
      await sleep(DELAY_MS);
      const sourceUrl = `${BASE}/Courses/${item.slug}/`;

      try {
        const prereqRaw = await scrapeCoursePage(item.slug);
        const { expr: prereqExpr, raw: cleanRaw } = parsePrereqs(
          prereqRaw,
          subject === "CS" ? "COMPSCI" : "EE"
        );

        const course: ScrapedCourse = {
          code: parseDisplayCode(item.displayCode),
          displayCode: item.displayCode,
          title: item.title,
          department: inferDepartment(subject),
          units: parseUnits(item.units),
          description: item.description,
          prereqExpr,
          prereqRaw: cleanRaw,
          sourceUrl,
        };

        all.push(course);
        console.log(
          `  ✓ ${item.displayCode} — prereq: ${cleanRaw ?? "none"}`
        );
      } catch (err) {
        console.error(`  ✗ ${item.displayCode}: ${(err as Error).message}`);
      }
    }
  }

  return all;
}

// ─── Run as script ─────────────────────────────────────────────────────────

async function main() {
  console.log("Starting EECS scraper...");
  const courses = await scrapeEECS();
  console.log(`\nScraped ${courses.length} courses total`);

  const outDir = join(process.cwd(), "data", "scraped");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "eecs.json");
  writeFileSync(outPath, JSON.stringify(courses, null, 2));
  console.log(`Written to ${outPath}`);

  // Summary
  const withPrereqs = courses.filter((c) => c.prereqExpr !== null);
  const withoutPrereqs = courses.filter((c) => c.prereqExpr === null);
  console.log(`\nSummary:`);
  console.log(`  ${withPrereqs.length} courses with parsed prerequisites`);
  console.log(`  ${withoutPrereqs.length} courses with no prerequisites`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
