import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-(--color-rule) bg-(--color-paper-raised)">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2.5 group">
            <span className="course-code text-xs px-1.5 py-0.5 bg-(--color-blue) text-white rounded-sm">
              BERKELEY
            </span>
            <span className="font-serif text-lg font-semibold text-(--color-ink) group-hover:text-(--color-blue) transition-colors">
              Course Graph
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/"
              className="text-(--color-ink-soft) hover:text-(--color-blue) transition-colors"
            >
              Search
            </Link>
            <Link
              href="/planner"
              className="text-(--color-ink-soft) hover:text-(--color-blue) transition-colors"
            >
              Plan a semester
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
