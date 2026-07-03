/**
 * Fix abbreviated course titles in data/scraped/catalog.json
 * ===========================================================
 * The original scrape stored the registrar's abbreviated `name` field.
 * Full titles live in the API's `longName` field. This patches titles 
 * in place using only the bulk API — no individual page fetching.
 *
 * Run: npm run fix:titles
 * Then: npm run db:seed
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CATALOG_ID = "hMSTjIplK6VX5nnJn7ZE";
const API_BASE = "https://app.coursedog.com/api/v1/cm/ucberkeley_peoplesoft";
const API_BATCH = 500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBatch(skip: number): Promise<{ data: any[]; listLength: number }> {
  const params = new URLSearchParams({
    catalogId: CATALOG_ID,
    skip: String(skip),
    limit: String(API_BATCH),
    orderBy: "subjectCode",
    formatDependents: "false",
    effectiveDatesRange: "2027-05-24,2027-05-24",
    ignoreEffectiveDating: "false",
    ignoreTotalCount: "false",
    columns: "courseGroupId,subjectCode,courseNumber,name,longName",
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API_BASE}/courses/search/%24filters?${params}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        origin: "https://undergraduate.catalog.berkeley.edu",
        referer: "https://undergraduate.catalog.berkeley.edu/",
        "x-requested-with": "catalog",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        condition: "AND",
        filters: [
          {
            condition: "and",
            id: "main",
            filters: [
              { id: "status-course", condition: "field", name: "status", inputType: "select", group: "course", type: "is", value: "Active", customField: false },
              { id: "catalogPrint-course", condition: "field", name: "catalogPrint", inputType: "boolean", group: "course", type: "is", value: true, customField: false },
              { id: "courseApproved-course", condition: "field", name: "courseApproved", inputType: "select", group: "course", type: "is", value: "Approved", customField: false },
            ],
          },
        ],
      }),
    });

    if (res.ok) return res.json();
    if ([429, 502, 503].includes(res.status)) {
      await sleep(2000 * Math.pow(2, attempt));
      continue;
    }
    throw new Error(`API error ${res.status}`);
  }
  throw new Error("Max retries exceeded");
}

async function main() {
  const catalogPath = join(process.cwd(), "data", "scraped", "catalog.json");
  if (!existsSync(catalogPath)) {
    console.error("No data/scraped/catalog.json found.");
    process.exit(1);
  }

  const courses = JSON.parse(readFileSync(catalogPath, "utf8"));
  console.log(`Loaded ${courses.length} scraped courses`);

  // Fetch all course names from the API
  console.log("Fetching full titles from API...");
  const first = await fetchBatch(0);
  const total = first.listLength;
  const apiCourses = [...first.data];
  let skip = API_BATCH;
  while (skip < total) {
    await sleep(200);
    const batch = await fetchBatch(skip);
    apiCourses.push(...batch.data);
    skip += API_BATCH;
    console.log(`  ${Math.min(skip, total)}/${total}`);
  }

  // Map courseGroupId -> longName
  const titleByGroup = new Map<string, string>();
  for (const c of apiCourses) {
    if (c.courseGroupId && c.longName) {
      titleByGroup.set(String(c.courseGroupId), c.longName);
    }
  }
  console.log(`Got ${titleByGroup.size} full titles from API`);

  // Patch titles using the courseGroupId embedded in each catalogUrl
  let patched = 0;
  for (const c of courses) {
    const m = c.catalogUrl?.match(/courses\/(\d+)/);
    if (!m) continue;
    const longName = titleByGroup.get(m[1]);
    if (longName && longName !== c.title) {
      c.title = longName;
      patched++;
    }
  }

  writeFileSync(catalogPath, JSON.stringify(courses, null, 2));
  console.log(`✓ Patched ${patched} titles in ${catalogPath}`);
  console.log("Now run: npm run db:seed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
