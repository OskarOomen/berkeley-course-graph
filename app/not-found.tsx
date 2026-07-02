import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="course-code text-xs text-(--color-ink-soft) mb-3">404</p>
      <h1 className="font-serif text-2xl font-semibold mb-3">
        Course or page not found
      </h1>
      <p className="text-sm text-(--color-ink-soft) mb-8">
        That course code or plan doesn't exist in the catalog.
      </p>
      <Link
        href="/"
        className="text-sm text-(--color-blue) hover:underline"
      >
        ← Back to search
      </Link>
    </div>
  );
}
