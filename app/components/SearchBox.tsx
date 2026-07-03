"use client";

/**
 * Search box with autocomplete from the trie
 * Fetches the course list once, builds a prefix trie client-side, 
 * and shows ranked suggestions as you type. Suggestions update in 
 * O(p + k) per keystroke
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildCourseTrie, Trie } from "@/lib/trie";

export default function SearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [trie, setTrie] = useState<Trie | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Build the trie once from the full course list
  useEffect(() => {
    let cancelled = false;
    fetch("/api/courses")
      .then((r) => r.json())
      .then((courses: { displayCode: string; title: string }[]) => {
        if (!cancelled) setTrie(buildCourseTrie(courses));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => {
    if (!trie || !query.trim()) return [];
    return trie.suggest(query, 6);
  }, [trie, query]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submit(q: string) {
    setOpen(false);
    router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") submit(query);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0) {
        setQuery(suggestions[highlight]);
        submit(suggestions[highlight]);
      } else {
        submit(query);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative mb-10">
      <div className="flex border border-(--color-rule) bg-(--color-paper-raised) rounded-sm overflow-hidden focus-within:border-(--color-blue) transition-colors">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search by code or title — try “61B” or “algorithms”"
          className="flex-1 px-4 py-3 text-sm bg-transparent outline-none placeholder:text-(--color-ink-soft)"
          autoFocus
          autoComplete="off"
        />
        <button
          onClick={() => submit(query)}
          className="px-5 text-sm font-medium bg-(--color-blue) text-white hover:bg-(--color-blue)/90 transition-colors"
        >
          Search
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 left-0 right-24 mt-1 border border-(--color-rule) bg-(--color-paper-raised) rounded-sm shadow-sm overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={s}>
              <button
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  i === highlight
                    ? "bg-(--color-blue) text-white"
                    : "hover:bg-(--color-rule)/30"
                }`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  setQuery(s);
                  submit(s);
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
