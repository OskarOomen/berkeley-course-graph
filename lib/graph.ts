import type { CourseRecord, PrereqExpr } from "./types";

/**
 * Berkeley Course Graph — graph engine
 * ------------------------------------
 * Courses are nodes. Prerequisites are directed edges (prereq -> course).
 * Because a real prereq isn't always a simple chain (CS 188 needs
 * (CS61A OR CS61B) AND CS70), each course stores a small boolean expression
 * tree rather than a flat list of required courses. Everything below either
 * walks that tree directly, or first flattens it into a plain dependency
 * graph (every COURSE leaf becomes an edge) when a plain graph algorithm
 * (BFS/DFS/topo sort) is the right tool.
 */

export type Graph = Map<string, Set<string>>; // course code -> set of direct prereq codes

/** Collect every course code referenced anywhere inside a prereq expression. */
function leavesOf(expr: PrereqExpr): string[] {
  if (expr.type === "COURSE") return [expr.code];
  return expr.items.flatMap(leavesOf);
}

/**
 * Flatten every course's boolean prereq expression into a plain directed
 * graph: course -> set of courses that appear anywhere in its prereq tree
 * (regardless of AND/OR). This is the structure DFS/BFS/topo-sort operate on.
 * Losing the AND/OR distinction here is intentional — for "what's the full
 * ancestor chain" and "what order could I take these in," every course that
 * appears in the tree at all is relevant. AND/OR only matters when checking
 * whether a *specific* plan satisfies a requirement, which is handled
 * separately in validatePlan() using the real tree, not this flattened graph.
 */
export function buildGraph(courses: CourseRecord[]): Graph {
  const graph: Graph = new Map();
  for (const c of courses) {
    graph.set(c.code, new Set());
  }
  for (const c of courses) {
    if (!c.prereqExpr) continue;
    for (const code of leavesOf(c.prereqExpr)) {
      graph.get(c.code)?.add(code);
    }
  }
  return graph;
}

/**
 * BFS over the prereq graph to find every course that must eventually be
 * taken before `code` — the full ancestor chain, not just direct prereqs.
 * Returns codes in BFS order (roughly: closest prereqs first).
 */
export function getFullPrereqChain(graph: Graph, code: string): string[] {
  const visited = new Set<string>();
  const queue: string[] = [...(graph.get(code) ?? [])];
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    order.push(current);
    for (const next of graph.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return order;
}

/**
 * DFS to find every course that directly or indirectly REQUIRES `code` —
 * i.e. walking the graph in reverse. Used for "what does taking this course
 * unlock" on a course detail page.
 */
export function getDownstreamCourses(graph: Graph, code: string): string[] {
  const reverse: Graph = new Map();
  for (const [course, prereqs] of graph) {
    for (const p of prereqs) {
      if (!reverse.has(p)) reverse.set(p, new Set());
      reverse.get(p)!.add(course);
    }
  }

  const visited = new Set<string>();
  const result: string[] = [];

  function dfs(node: string) {
    for (const next of reverse.get(node) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      result.push(next);
      dfs(next);
    }
  }
  dfs(code);
  return result;
}

/**
 * Detect a prerequisite cycle anywhere in the graph using DFS with a
 * recursion stack. A cycle would mean course A (transitively) requires
 * itself, which should be impossible for a real degree plan but is worth
 * guarding against — a single bad data entry could otherwise infinite-loop
 * every traversal above.
 */
export function findCycle(graph: Graph): string[] | null {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const next of graph.get(node) ?? []) {
      if (!visited.has(next)) {
        const found = dfs(next);
        if (found) return found;
      } else if (inStack.has(next)) {
        const cycleStart = path.indexOf(next);
        return path.slice(cycleStart).concat(next);
      }
    }

    path.pop();
    inStack.delete(node);
    return null;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      const found = dfs(node);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Kahn's algorithm: produce ONE valid topological ordering of the full
 * course set (prereqs before the courses that need them). Courses with no
 * ordering constraint relative to each other are emitted in alphabetical
 * order within their "ready" tier, just to make the output deterministic.
 *
 * Note there are usually many valid orderings — this returns a single
 * reasonable one, mainly useful as a "suggested sequence" baseline, not a
 * strict requirement.
 */
export function topologicalSort(graph: Graph): string[] {
  const inDegree = new Map<string, number>();
  for (const node of graph.keys()) inDegree.set(node, 0);
  for (const [, prereqs] of graph) {
    for (const p of prereqs) {
      // edge direction for Kahn's algorithm: prereq -> course
      inDegree.set(p, inDegree.get(p) ?? 0);
    }
  }
  // recompute in-degree as "number of prereqs not yet satisfied"
  for (const node of graph.keys()) inDegree.set(node, graph.get(node)!.size);

  const ready: string[] = [...graph.keys()]
    .filter((n) => inDegree.get(n) === 0)
    .sort();
  const order: string[] = [];
  const remaining = new Map(inDegree);

  // dependents[x] = courses that list x as a prereq
  const dependents: Graph = new Map();
  for (const node of graph.keys()) dependents.set(node, new Set());
  for (const [course, prereqs] of graph) {
    for (const p of prereqs) dependents.get(p)?.add(course);
  }

  const queue = [...ready];
  while (queue.length > 0) {
    queue.sort(); // keep output deterministic
    const node = queue.shift()!;
    order.push(node);
    for (const dep of dependents.get(node) ?? []) {
      remaining.set(dep, (remaining.get(dep) ?? 0) - 1);
      if (remaining.get(dep) === 0) queue.push(dep);
    }
  }

  return order;
}

/** Evaluate whether a boolean prereq expression is satisfied by a set of completed course codes. */
export function isSatisfied(expr: PrereqExpr, completed: Set<string>): boolean {
  if (expr.type === "COURSE") return completed.has(expr.code);
  if (expr.type === "AND") return expr.items.every((i) => isSatisfied(i, completed));
  return expr.items.some((i) => isSatisfied(i, completed)); // OR
}

/** Human-readable rendering of a prereq expression, e.g. "CS 61B and (Math 54 or EECS 16A)". */
export function describeExpr(
  expr: PrereqExpr,
  displayName: (code: string) => string
): string {
  if (expr.type === "COURSE") return displayName(expr.code);
  const sep = expr.type === "AND" ? " and " : " or ";
  const parts = expr.items.map((i) => {
    const inner = describeExpr(i, displayName);
    // wrap nested OR-inside-AND (or vice versa) in parens for clarity
    return i.type !== "COURSE" && i.type !== expr.type ? `(${inner})` : inner;
  });
  return parts.join(sep);
}
