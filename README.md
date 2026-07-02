# Berkeley Course Graph

A Next.js web app that models UC Berkeley CS/EECS/Math courses as a prerequisite graph, with semester planning and shareable academic plans.

### Prefix trie (search autocomplete)

`lib/trie.ts`. Suggestions as you type are powered by a character-keyed prefix
trie built client-side from the course list. Lookup is O(p + k): walk p
characters to the prefix node, then DFS the subtree collecting completed
terms. Insert keys and returned terms are decoupled, so one course is
reachable by several keys — its display code ("CS 61A"), the spaceless form
("cs61a"), and the bare number ("61a"). Weighted ranking makes exact course
codes outrank title-word matches for the same prefix.

### Cross-listing canonicalization

`lib/merge-cross-listed.ts`. Berkeley cross-lists one course under several
departments (MEC ENG C85 = CIV ENG C30). PeopleSoft encodes this: the
per-subject versions share the first 6 digits of their course-group ID. At
seed time, courses are grouped into families by that prefix (with a
title-equality guard against false positives), one canonical version is kept
per family, and **every prerequisite expression in the dataset is rewritten**
so alias references resolve to the canonical node — then deduplicated, since
"C85 or C30" collapses to a single course after rewriting. Without this step
the graph would contain phantom duplicate nodes and prereq checking would
fail for students who took the "other" listing.

## Setup

```bash
npm install
npm run db:seed   # creates dev.db and seeds course data
npm run dev       # http://localhost:3000
```

That's it. No external database server. SQLite runs as a local file (`dev.db`).

## What it does

- **Search** — find any course by code or title
- **Course pages** — visual prerequisite diagram, full ancestor chain (BFS), downstream unlocked courses (DFS)
- **Semester planner** — drag courses into 8 semester boxes; live prerequisite validation fires on every change
- **Share link** — save a plan and get a `/plans/:id` URL anyone can open

## How the graph works

Each course stores its prerequisites as a **boolean expression tree** (not a flat list), because real prerequisites aren't always simple chains. For example:

```
CS 188 requires: (CS 61A OR CS 61B) AND CS 70
CS 189 requires: CS 61B AND CS 70 AND Math 53 AND (Math 54 OR EECS 16A)
```

Algorithms in `lib/graph.ts`:

| Algorithm | Where used |
|-----------|-----------|
| BFS over prereq graph | Full prereq chain on course pages |
| DFS in reverse | "What does this unlock" section |
| DFS with recursion stack | Cycle detection on startup |
| Kahn's algorithm (topo sort) | Suggested valid take-order |
| Boolean tree eval (`isSatisfied`) | Prereq validation in the planner |

**Key validation edge case**: courses in the *same* semester don't satisfy each other's prerequisites. If you put CS 61B and CS 170 in Fall 2026, CS 170 will warn — you can't have already taken a course you're currently taking. This is handled in `lib/validate-plan.ts` by evaluating each semester in order and only adding its courses to the "completed" set *after* that semester is checked.

## Tech decisions worth knowing for an interview

- **Boolean expression tree for prereqs** — a flat list of edges can't represent `(A OR B) AND C`. The tree doubles as the diagram layout data.
- **SQLite locally / libSQL for production** — `@libsql/client` talks to a local file in dev and a Turso cloud database in prod with zero code change; just swap the env var.
- **`ON CONFLICT DO UPDATE`** — the seed script is idempotent; running it twice won't break anything.
- **Topo sort for plan suggestions** — Kahn's algorithm with alphabetical tiebreaking ensures a deterministic output, which matters for consistent UI behavior.
- **`force-dynamic`** on the search page — ensures Next.js re-runs the server component on every request so search results aren't stale.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- @libsql/client (SQLite locally, Turso-compatible for prod)
- nanoid (short share-link IDs)

## Deploying

1. Create a free Turso database: `turso db create course-graph`
2. Get the URL and token: `turso db show course-graph --url`, `turso db tokens create course-graph`
3. Set env vars on Vercel: `DATABASE_URL=libsql://...` and `DATABASE_AUTH_TOKEN=...`
4. Run `npm run db:seed` against the remote DB once (set the env vars locally first)
5. Push to GitHub → connect to Vercel → deploy

## Extending the course catalog

Add entries to `data/seed-courses.ts` and re-run `npm run db:seed`. The prereq expression syntax is:

```typescript
course("CS61B")                          // single prereq
and(course("CS61B"), course("CS70"))     // both required
or(course("CS61A"), course("CS88"))      // either works
and(course("CS61B"), or(course("MATH54"), course("EECS16A")))  // nested
```
