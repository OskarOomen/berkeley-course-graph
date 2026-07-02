/**
 * Manual prerequisite overrides
 * ==============================
 * Courses where the catalog page uses a structured multi-block format the
 * scraper can't parse, or where the source text has typos. Verified against
 * the official catalog by hand. Applied at seed time — these take priority
 * over scraped data.
 *
 * Key: normalized course code. Value: raw prereq text (run through the
 * normal parser at seed time).
 */

export const PREREQ_OVERRIDES: Record<string, string> = {
  // Quantum computing cross-list (CHEM/PHYSICS/CS C191): structured
  // "Requirement 1 / Requirement 2" page. Verified via catalog:
  // linear algebra AND (discrete math OR quantum mechanics)
  CHEMC191A:
    "ELENG 66, PHYSICS 89, or MATH 54; and COMPSCI 70, MATH 55, PHYSICS 7C, PHYSICS 137A, or CHEM 120A",
  PHYSC191A:
    "ELENG 66, PHYSICS 89, or MATH 54; and COMPSCI 70, MATH 55, PHYSICS 7C, PHYSICS 137A, or CHEM 120A",

  // EE C128 / ME C134 (feedback control): structured page. Per EECS site,
  // ELENG 66 is the hard requirement (Math 110 / EE 120 "desirable").
  EECSC128: "ELENG 66",
  MEC134: "ELENG 66",

  // MATH 152 (structured page). Second course in the math-of-teaching
  // sequence; requires MATH 151.
  MATH152: "MATH 151",

  // BIOENG 163L: source page lists the course as its own prereq (typo).
  // The lecture course is the real requirement.
  BIOE163L: "BIOENG 163",

  // MECENG 103: source text uses unparseable shorthand "MEC85, ME40, ...".
  ME103: "MECENG C85, MECENG 40, MECENG 106, and MECENG 109",

  // EECS 149: catalog page has "ELENG 66 and ELENG 66" (source typo).
  // EECS site confirms 64 and 66.
  EECS149: "COMPSCI 61C, COMPSCI 70, ELENG 64, and ELENG 66",

  // STAT 135: page has prereqs but in a layout the scraper missed on this
  // run. Verified via catalog.
  STAT135: "STAT 134 or STAT 140; and MATH 54, EL ENG 16A, STAT 89A, or MATH 110",

  // STAT C100 = DATA C100: cross-listed structured page. Verified.
  STATC100: "DATA C8 or STAT 20; and COMPSCI 61A, COMPSCI C88C, or ENGIN 7",

  // Physics upper-division core: structured pages showed "none".
  // Standard published requirements.
  PHYS137A: "PHYSICS 7C or PHYSICS 5C; and MATH 53; and MATH 54",
  PHYS110A: "PHYSICS 7C or PHYSICS 5C; and MATH 53; and MATH 54",
  PHYS105: "PHYSICS 7C or PHYSICS 5C; and MATH 53; and MATH 54",

  // MEC ENG C85 / CIV ENG C30: scraped text was thin on both listings.
  MEC85: "MATH 53 and PHYSICS 7A",

  // ELENG 121: catalog text says COMPSCI 170 but EECS site (and course
  // content — digital communication needs probability) say COMPSCI 70.
  EE121: "ELENG 64, ELENG 66, and COMPSCI 70",
};
