"use client";

const ANON_KEY = "bcg_anon_id";

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

const sentThisSession = new Set<string>();

export function track(event: "course_added" | "plan_saved" | "planner_opened") {
  if (sentThisSession.has(event)) return;
  sentThisSession.add(event);
  try {
    const body = JSON.stringify({ event, anonId: getAnonId() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}
}
