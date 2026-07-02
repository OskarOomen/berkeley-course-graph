import type { CourseRecord, PrereqExpr } from "@/lib/types";

/**
 * Renders a course's prerequisite boolean-expression tree as a left-to-right
 * flowchart: leaf course boxes feed into small AND/OR junction dots, which
 * feed into the target course box on the right. This intentionally mirrors
 * the PrereqExpr data structure directly (a box per COURSE leaf, a dot per
 * AND/OR node) rather than flattening to a generic graph, so the diagram can
 * show real boolean logic instead of just "these courses are involved."
 */

const ROW_H = 60;
const COL_W = 210;
const BOX_W = 168;
const BOX_H = 46;

interface PositionedBox {
  kind: "course";
  x: number;
  y: number; // center y
  code: string;
}
interface PositionedJunction {
  kind: "junction";
  x: number;
  y: number;
  label: "AND" | "OR";
}
type PositionedNode = PositionedBox | PositionedJunction;
interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function maxDepthOf(expr: PrereqExpr, depth = 1): number {
  if (expr.type === "COURSE") return depth;
  return Math.max(...expr.items.map((i) => maxDepthOf(i, depth + 1)));
}

function outAnchor(n: PositionedNode) {
  return n.kind === "course" ? { x: n.x + BOX_W, y: n.y } : { x: n.x, y: n.y };
}
function inAnchor(n: PositionedNode) {
  return n.kind === "course" ? { x: n.x, y: n.y } : { x: n.x, y: n.y };
}

function buildLayout(rootExpr: PrereqExpr, rootCode: string) {
  const nodes: PositionedNode[] = [];
  const edges: Edge[] = [];
  const maxDepth = maxDepthOf(rootExpr);
  let rowCursor = 0;

  function place(expr: PrereqExpr, depth: number): PositionedNode {
    if (expr.type === "COURSE") {
      const y = rowCursor * ROW_H + BOX_H / 2;
      rowCursor++;
      const node: PositionedBox = {
        kind: "course",
        x: (maxDepth - depth) * COL_W,
        y,
        code: expr.code,
      };
      nodes.push(node);
      return node;
    }
    const children = expr.items.map((item) => place(item, depth + 1));
    const ys = children.map((c) => c.y);
    const node: PositionedJunction = {
      kind: "junction",
      x: (maxDepth - depth) * COL_W,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
      label: expr.type,
    };
    nodes.push(node);
    for (const child of children) {
      const a = outAnchor(child);
      const b = inAnchor(node);
      edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return node;
  }

  const prereqRoot = place(rootExpr, 1);
  const rootBox: PositionedBox = {
    kind: "course",
    x: maxDepth * COL_W,
    y: prereqRoot.y,
    code: rootCode,
  };
  nodes.push(rootBox);
  const a = outAnchor(prereqRoot);
  edges.push({ x1: a.x, y1: a.y, x2: rootBox.x, y2: rootBox.y });

  return {
    nodes,
    edges,
    width: (maxDepth + 1) * COL_W,
    height: Math.max(rowCursor * ROW_H, ROW_H),
  };
}

export function PrereqDiagram({
  course,
  courseMap,
}: {
  course: CourseRecord;
  courseMap: Map<string, CourseRecord>;
}) {
  if (!course.prereqExpr) {
    return (
      <div className="flex items-center gap-3 py-6">
        <span className="course-code text-sm px-2 py-1 bg-(--color-blue) text-white rounded-sm">
          {course.displayCode}
        </span>
        <span className="text-sm text-(--color-ink-soft)">
          has no formal prerequisites.
        </span>
      </div>
    );
  }

  const { nodes, edges, width, height } = buildLayout(
    course.prereqExpr,
    course.code
  );
  const PAD = 24;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width + PAD * 2} ${height + PAD * 2}`}
        width={width + PAD * 2}
        height={height + PAD * 2}
        className="min-w-full"
        role="img"
        aria-label={`Prerequisite chain for ${course.displayCode}`}
      >
        <g transform={`translate(${PAD}, ${PAD})`}>
          {edges.map((e, i) => (
            <line
              key={i}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke="var(--color-rule)"
              strokeWidth={1.5}
            />
          ))}
          {nodes.map((n, i) => {
            if (n.kind === "junction") {
              return (
                <g key={i}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={4}
                    fill="var(--color-paper)"
                    stroke="var(--color-gold)"
                    strokeWidth={2}
                  />
                  <text
                    x={n.x}
                    y={n.y - 10}
                    textAnchor="middle"
                    className="course-code"
                    fontSize={10}
                    fill="var(--color-blue)"
                    fontWeight={600}
                  >
                    {n.label}
                  </text>
                </g>
              );
            }
            const c = courseMap.get(n.code);
            const isRoot = n.code === course.code;
            return (
              <foreignObject
                key={i}
                x={n.x}
                y={n.y - BOX_H / 2}
                width={BOX_W}
                height={BOX_H}
              >
                <a
                  href={isRoot ? undefined : `/courses/${n.code}`}
                  className={`flex h-full flex-col justify-center rounded-sm border px-2.5 py-1 leading-tight no-underline transition-colors ${
                    isRoot
                      ? "border-(--color-blue) bg-(--color-blue) text-white"
                      : "border-(--color-rule) bg-(--color-paper-raised) text-(--color-ink) hover:border-(--color-blue)"
                  }`}
                >
                  <span className="course-code text-[11px]">
                    {c?.displayCode ?? n.code}
                  </span>
                  {c && (
                    <span
                      className={`truncate text-[10px] ${
                        isRoot ? "text-white/80" : "text-(--color-ink-soft)"
                      }`}
                    >
                      {c.title}
                    </span>
                  )}
                </a>
              </foreignObject>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
