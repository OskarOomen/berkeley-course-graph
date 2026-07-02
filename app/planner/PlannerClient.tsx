"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CourseRecord, PlanData, PlanWarning, Semester } from "@/lib/types";
import { buildGraph, getFullPrereqChain } from "@/lib/graph";
import { validatePlan, findDuplicatePlacements, sortSemesters } from "@/lib/validate-plan";
import { MAJORS } from "@/data/majors";
import { checkMajorProgress, countSatisfied } from "@/lib/major-progress";

// ────────────────────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const TERM_COLORS: Record<Semester["term"], string> = {
  Fall: "bg-(--color-blue-soft) text-(--color-blue)",
  Spring: "bg-(--color-gold-soft) text-amber-800",
  Summer: "bg-green-50 text-green-800",
};

function defaultSemesters(): Semester[] {
  return [
    { id: makeId(), label: "Fall 2025", year: 2025, term: "Fall", courseCodes: [] },
    { id: makeId(), label: "Spring 2026", year: 2026, term: "Spring", courseCodes: [] },
    { id: makeId(), label: "Fall 2026", year: 2026, term: "Fall", courseCodes: [] },
    { id: makeId(), label: "Spring 2027", year: 2027, term: "Spring", courseCodes: [] },
    { id: makeId(), label: "Fall 2027", year: 2027, term: "Fall", courseCodes: [] },
    { id: makeId(), label: "Spring 2028", year: 2028, term: "Spring", courseCodes: [] },
    { id: makeId(), label: "Fall 2028", year: 2028, term: "Fall", courseCodes: [] },
    { id: makeId(), label: "Spring 2029", year: 2029, term: "Spring", courseCodes: [] },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ────────────────────────────────────────────────────────────────────────────

function CourseChip({
  course,
  warnings,
  onRemove,
  draggable,
  onDragStart,
}: {
  course: CourseRecord;
  warnings: PlanWarning[];
  onRemove?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const hasWarn = warnings.length > 0;
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={`group flex items-start gap-1.5 rounded-sm border px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing ${
        hasWarn
          ? "border-(--color-rust) bg-(--color-rust-soft)"
          : "border-(--color-rule) bg-(--color-paper-raised)"
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className={`course-code font-medium ${hasWarn ? "text-(--color-rust)" : "text-(--color-blue)"}`}>
          {course.displayCode}
        </span>
        <div className="truncate text-(--color-ink-soft) mt-0.5">{course.title}</div>
        {hasWarn && (
          <div className="text-(--color-rust) mt-0.5 leading-snug">
            {warnings[0].message}
          </div>
        )}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="shrink-0 mt-0.5 text-(--color-ink-soft) hover:text-(--color-rust) transition-colors opacity-0 group-hover:opacity-100"
          aria-label={`Remove ${course.displayCode}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

function SemesterColumn({
  semester,
  courses,
  warnings,
  onDrop,
  onRemove,
  onDragStart,
  isDragOver,
  onDragOver,
  onDragLeave,
  totalUnits,
}: {
  semester: Semester;
  courses: CourseRecord[];
  warnings: PlanWarning[];
  onDrop: (e: React.DragEvent) => void;
  onRemove: (code: string) => void;
  onDragStart: (e: React.DragEvent, code: string, fromSemesterId: string) => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  totalUnits: number;
}) {
  const termColor = TERM_COLORS[semester.term];
  return (
    <div
      className={`flex flex-col rounded-sm border transition-colors ${
        isDragOver ? "border-(--color-blue) bg-(--color-blue-soft)" : "border-(--color-rule) bg-(--color-paper-raised)"
      }`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="px-3 pt-3 pb-2 border-b border-(--color-rule)">
        <div className="flex items-center justify-between">
          <span className={`course-code text-[10px] px-1.5 py-0.5 rounded-sm ${termColor}`}>
            {semester.term.toUpperCase()}
          </span>
          <span className="text-[10px] text-(--color-ink-soft) course-code">
            {totalUnits}u
          </span>
        </div>
        <div className="text-xs font-medium mt-1">{semester.label}</div>
      </div>
      <div className="p-2 flex-1 space-y-1.5 min-h-[80px]">
        {courses.map((c) => (
          <CourseChip
            key={c.code}
            course={c}
            warnings={warnings.filter((w) => w.courseCode === c.code && w.semesterId === semester.id)}
            onRemove={() => onRemove(c.code)}
            draggable
            onDragStart={(e) => onDragStart(e, c.code, semester.id)}
          />
        ))}
        {courses.length === 0 && (
          <div className="flex h-10 items-center justify-center text-[10px] text-(--color-ink-soft)/50 select-none">
            drag courses here
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  Main Planner
// ────────────────────────────────────────────────────────────────────────────

export default function PlannerClient() {
  const [allCourses, setAllCourses] = useState<CourseRecord[]>([]);
  const [courseMap, setCourseMap] = useState<Map<string, CourseRecord>>(new Map());
  const [semesters, setSemesters] = useState<Semester[]>(defaultSemesters);
  const [planName, setPlanName] = useState("My 4-Year Plan");
  const [majorId, setMajorId] = useState<string>("cs-ba");
  const [sidebarTab, setSidebarTab] = useState<"search" | "requirements">("search");
  const [query, setQuery] = useState("");
  const [warnings, setWarnings] = useState<PlanWarning[]>([]);
  const [dupes, setDupes] = useState<string[]>([]);
  const [dragState, setDragState] = useState<{
    code: string;
    fromSemesterId: string | null;
  } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  // Load courses from the API
  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((data: CourseRecord[]) => {
        setAllCourses(data);
        setCourseMap(new Map(data.map((c) => [c.code, c])));
      })
      .catch(console.error);
  }, []);

  // Revalidate whenever semesters change
  useEffect(() => {
    if (allCourses.length === 0) return;
    const plan: PlanData = { semesters };
    setWarnings(validatePlan(plan, courseMap));
    setDupes(findDuplicatePlacements(plan));
  }, [semesters, allCourses, courseMap]);

  // Search results: courses not yet placed anywhere in the plan
  const placedCodes = new Set(semesters.flatMap((s) => s.courseCodes));
  const searchResults = query.trim()
    ? allCourses.filter(
        (c) =>
          !placedCodes.has(c.code) &&
          (c.code.toLowerCase().includes(query.toLowerCase()) ||
            c.displayCode.toLowerCase().includes(query.toLowerCase()) ||
            c.title.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  const addCourse = useCallback(
    (code: string, semesterId: string) => {
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === semesterId && !s.courseCodes.includes(code)
            ? { ...s, courseCodes: [...s.courseCodes, code] }
            : s
        )
      );
    },
    []
  );

  const removeCourse = useCallback((code: string, semesterId: string) => {
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semesterId
          ? { ...s, courseCodes: s.courseCodes.filter((c) => c !== code) }
          : s
      )
    );
  }, []);

  // Drag between semesters
  const handleDragStart = (
    e: React.DragEvent,
    code: string,
    fromSemesterId: string | null
  ) => {
    e.dataTransfer.effectAllowed = "move";
    setDragState({ code, fromSemesterId });
  };

  const handleDrop = (e: React.DragEvent, targetSemesterId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragState) return;
    const { code, fromSemesterId } = dragState;

    if (fromSemesterId === targetSemesterId) {
      setDragState(null);
      return;
    }
    // Remove from old semester if this was a move (not from the search tray)
    if (fromSemesterId) {
      removeCourse(code, fromSemesterId);
    }
    addCourse(code, targetSemesterId);
    setDragState(null);
    setQuery("");
  };

  // Suggest prereq chain to fill in automatically
  const graphRef = useRef<ReturnType<typeof buildGraph> | null>(null);
  useEffect(() => {
    if (allCourses.length > 0) {
      graphRef.current = buildGraph(allCourses);
    }
  }, [allCourses]);

  const suggestChain = (code: string) => {
    if (!graphRef.current) return;
    const chain = getFullPrereqChain(graphRef.current, code);
    const sorted = sortSemesters(semesters);
    // Fill chain courses into earliest available semesters
    const needed = chain.filter((c) => !placedCodes.has(c));
    let newSemesters = [...semesters];
    needed.forEach((c, i) => {
      const targetSem = sorted[i % sorted.length];
      newSemesters = newSemesters.map((s) =>
        s.id === targetSem.id && !s.courseCodes.includes(c)
          ? { ...s, courseCodes: [...s.courseCodes, c] }
          : s
      );
    });
    setSemesters(newSemesters);
  };

  // Save / share
  const savePlan = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const method = planId ? "PUT" : "POST";
      const url = planId ? `/api/plans/${planId}` : "/api/plans";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { semesters }, name: planName }),
      });
      if (!res.ok) throw new Error("Save failed");
      const json = await res.json();
      const id = planId ?? json.id;
      setPlanId(id);
      const link = `${window.location.origin}/plans/${id}`;
      setShareUrl(link);
    } catch {
      setSaveError("Couldn't save — make sure the dev server is running.");
    } finally {
      setSaving(false);
    }
  };

  const totalUnitsInSemester = (sem: Semester) =>
    sem.courseCodes.reduce((acc, code) => acc + (courseMap.get(code)?.units ?? 0), 0);

  const totalWarnings = warnings.length + dupes.length;

  // Major progress
  const selectedMajor = MAJORS.find((m) => m.id === majorId) ?? MAJORS[0];
  const majorStatuses = checkMajorProgress(selectedMajor, { semesters });
  const groupsDone = countSatisfied(majorStatuses);
  const groupsTotal = selectedMajor.requirements.length;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* ── Left sidebar ── */}
      <aside className="w-72 shrink-0 border-r border-(--color-rule) flex flex-col bg-(--color-paper-raised)">

        {/* Major selector */}
        <div className="p-3 border-b border-(--color-rule)">
          <label className="course-code text-[10px] text-(--color-ink-soft) uppercase tracking-wide block mb-1.5">
            My Major
          </label>
          <select
            value={majorId}
            onChange={(e) => setMajorId(e.target.value)}
            className="w-full text-xs border border-(--color-rule) bg-(--color-paper) rounded-sm px-2 py-1.5 outline-none focus:border-(--color-blue) transition-colors"
          >
            {MAJORS.map((m) => (
              <option key={m.id} value={m.id}>{m.shortName}</option>
            ))}
          </select>
          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-(--color-rule) rounded-full overflow-hidden">
              <div
                className="h-full bg-(--color-blue) transition-all"
                style={{ width: `${groupsTotal ? (groupsDone / groupsTotal) * 100 : 0}%` }}
              />
            </div>
            <span className="course-code text-[10px] text-(--color-ink-soft) shrink-0">
              {groupsDone}/{groupsTotal}
            </span>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex border-b border-(--color-rule)">
          {(["search", "requirements"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={`flex-1 py-2 text-[11px] course-code uppercase tracking-wide transition-colors ${
                sidebarTab === tab
                  ? "text-(--color-blue) border-b-2 border-(--color-blue)"
                  : "text-(--color-ink-soft) hover:text-(--color-ink)"
              }`}
            >
              {tab === "search" ? "Add Courses" : "Requirements"}
            </button>
          ))}
        </div>

        {/* Search tab */}
        {sidebarTab === "search" && (
          <>
            <div className="p-3 border-b border-(--color-rule)">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search \u2014 e.g. "CS 61B"`}
                className="w-full text-sm border border-(--color-rule) bg-(--color-paper) rounded-sm px-3 py-2 outline-none focus:border-(--color-blue) transition-colors placeholder:text-(--color-ink-soft)/60"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {searchResults.length === 0 && query.trim() && (
                <p className="text-xs text-(--color-ink-soft) px-1">No results.</p>
              )}
              {searchResults.length === 0 && !query.trim() && (
                <p className="text-xs text-(--color-ink-soft) px-1 leading-relaxed">
                  Search for a course, then drag it into a semester column.
                </p>
              )}
              {searchResults.map((c) => (
                <div
                  key={c.code}
                  draggable
                  onDragStart={(e) => handleDragStart(e, c.code, null)}
                  className="rounded-sm border border-(--color-rule) bg-(--color-paper) px-2.5 py-2 cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="course-code text-[11px] text-(--color-blue) font-medium">
                        {c.displayCode}
                      </span>
                      <div className="text-xs text-(--color-ink-soft) truncate">{c.title}</div>
                    </div>
                    <button
                      onClick={() => suggestChain(c.code)}
                      title="Auto-place full prereq chain"
                      className="text-[9px] course-code text-(--color-ink-soft) hover:text-(--color-blue) transition-colors shrink-0 pt-0.5"
                    >
                      + chain
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Requirements tab */}
        {sidebarTab === "requirements" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {selectedMajor.requirements.map((group) => {
              const status = majorStatuses.find((s) => s.groupId === group.id)!;
              return (
                <div key={group.id}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`text-[10px] ${status.satisfied ? "text-green-600" : "text-(--color-ink-soft)"}`}>
                      {status.satisfied ? "✓" : "○"}
                    </span>
                    <span className="course-code text-[10px] uppercase tracking-wide text-(--color-ink-soft)">
                      {group.label}
                    </span>
                    {group.type === "n-of" && (
                      <span className="ml-auto course-code text-[10px] text-(--color-ink-soft)">
                        {status.completed.length}/{group.n}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {[...new Set(group.courses)].map((code, ci) => {
                      const done = status.completed.includes(code);
                      const cr = courseMap.get(code);
                      return (
                        <div
                          key={`${group.id}-${code}-${ci}`}
                          draggable={!done}
                          onDragStart={!done ? (e) => handleDragStart(e, code, null) : undefined}
                          className={`flex items-center gap-2 rounded-sm px-2 py-1 text-xs transition-colors ${
                            done
                              ? "bg-green-50 border border-green-200"
                              : "border border-(--color-rule) bg-(--color-paper) cursor-grab active:cursor-grabbing"
                          }`}
                        >
                          <span className={`course-code text-[10px] shrink-0 ${done ? "text-green-700" : "text-(--color-blue)"}`}>
                            {cr?.displayCode ?? code}
                          </span>
                          {cr && (
                            <span className={`truncate text-[10px] ${done ? "text-green-600" : "text-(--color-ink-soft)"}`}>
                              {cr.title}
                            </span>
                          )}
                          {done && <span className="ml-auto text-green-500 shrink-0">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                  {group.note && (
                    <p className="mt-1 text-[10px] text-(--color-ink-soft) leading-snug">{group.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Prereq warnings footer */}
        {totalWarnings > 0 && (
          <div className="border-t border-(--color-rust)/30 bg-(--color-rust-soft) p-3">
            <p className="course-code text-[10px] text-(--color-rust) uppercase tracking-wide mb-2">
              {totalWarnings} prereq issue{totalWarnings !== 1 ? "s" : ""}
            </p>
            {dupes.map((code) => (
              <p key={code} className="text-[11px] text-(--color-rust) mb-1">
                {courseMap.get(code)?.displayCode ?? code} placed more than once.
              </p>
            ))}
            {warnings.slice(0, 4).map((w, i) => (
              <p key={i} className="text-[11px] text-(--color-rust) mb-1 leading-snug">
                {w.message}
              </p>
            ))}
            {warnings.length > 4 && (
              <p className="text-[11px] text-(--color-ink-soft)">+{warnings.length - 4} more…</p>
            )}
          </div>
        )}
        {totalWarnings === 0 && semesters.some((s) => s.courseCodes.length > 0) && (
          <div className="border-t border-green-200 bg-green-50 p-3">
            <p className="text-[11px] text-green-700 course-code">✓ All prereqs satisfied</p>
          </div>
        )}
      </aside>

      {/* ── Main area: semester grid ── */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 border-b border-(--color-rule) flex items-center justify-between gap-4 bg-(--color-paper-raised) sticky top-0 z-10">
          <input
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="font-serif text-base font-semibold bg-transparent outline-none border-b border-transparent focus:border-(--color-rule) transition-colors min-w-0 flex-1"
          />
          <div className="flex items-center gap-3 shrink-0">
            {shareUrl && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-xs text-(--color-blue) hover:underline course-code truncate max-w-48"
                title="Click to copy"
              >
                {copied ? "Copied ✓" : "Copy share link"}
              </button>
            )}
            <button
              onClick={savePlan}
              disabled={saving}
              className="text-xs px-3 py-1.5 bg-(--color-blue) text-white rounded-sm hover:bg-(--color-blue)/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save & share"}
            </button>
          </div>
        </div>
        {saveError && (
          <div className="mx-4 mt-3 text-xs text-(--color-rust) bg-(--color-rust-soft) border border-(--color-rust)/30 rounded-sm px-3 py-2">
            {saveError}
          </div>
        )}
        <div className="p-4 grid grid-cols-2 xl:grid-cols-4 gap-3">
          {sortSemesters(semesters).map((sem) => {
            const semCourses = sem.courseCodes
              .map((c) => courseMap.get(c))
              .filter(Boolean) as CourseRecord[];
            return (
              <SemesterColumn
                key={sem.id}
                semester={sem}
                courses={semCourses}
                warnings={warnings.filter((w) => w.semesterId === sem.id)}
                onDrop={(e) => handleDrop(e, sem.id)}
                onRemove={(code) => removeCourse(code, sem.id)}
                onDragStart={handleDragStart}
                isDragOver={dragOverId === sem.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(sem.id);
                }}
                onDragLeave={() => setDragOverId(null)}
                totalUnits={totalUnitsInSemester(sem)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
