/**
 * Manual prerequisite overrides
 * ==============================
 * Courses where the catalog page uses a structured multi-block format the
 * scraper can't parse, or where the source text has typos. Verified against
 * the official catalog by hand. Applied at seed time — these take priority
 * over scraped data.
 */

export const PREREQ_OVERRIDES: Record<string, string> = {
  CHEMC191A:
    "ELENG 66, PHYSICS 89, or MATH 54; and COMPSCI 70, MATH 55, PHYSICS 7C, PHYSICS 137A, or CHEM 120A",
  PHYSC191A:
    "ELENG 66, PHYSICS 89, or MATH 54; and COMPSCI 70, MATH 55, PHYSICS 7C, PHYSICS 137A, or CHEM 120A",
  EECSC128: "ELENG 66",
  MEC134: "ELENG 66",
  MATH152: "MATH 151",
  ME103: "MECENG C85, MECENG 40, MECENG 106, and MECENG 109",
  EECS149: "COMPSCI 61C, COMPSCI 70, ELENG 64, and ELENG 66",
  STAT135: "STAT 134 or STAT 140; and MATH 54, EL ENG 16A, STAT 89A, or MATH 110",
  STATC100: "DATA C8 or STAT 20; and COMPSCI 61A, COMPSCI C88C, or ENGIN 7",
  PHYS137A: "PHYSICS 7C or PHYSICS 5C; and MATH 53; and MATH 54",
  PHYS110A: "PHYSICS 7C or PHYSICS 5C; and MATH 53; and MATH 54",
  PHYS105: "PHYSICS 7C or PHYSICS 5C; and MATH 53; and MATH 54",
  MEC85: "MATH 53 and PHYSICS 7A",
  EE121: "ELENG 64, ELENG 66, and COMPSCI 70",
  MATH104: "MATH 53, MATH 54, and MATH 55",
};
