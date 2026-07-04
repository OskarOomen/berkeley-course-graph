// Common short forms
const ALIASES: Record<string, string> = {
  cs: "COMPSCI",
  ee: "ELENG",
  "el eng": "ELENG",
  stats: "STAT",
  "data science": "DATA",
  ds: "DATA",
  me: "MECENG",
  "mech eng": "MECENG",
  ce: "CIVENG",
  chem: "CHEM",
  bio: "BIOLOGY",
  "bio eng": "BIOENG",
  ne: "NUCENG",
};

/**
 * "cs 61a" -> "COMPSCI 61a", "cs61a" -> "COMPSCI61a", "cs" -> "COMPSCI".
 * Returns the original query unchanged when no alias matches.
 */
export function expandDeptAlias(query: string): string {
  const q = query.trim().toLowerCase();
  // longest aliases first so "el eng" beats "ee" etc.
  const keys = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of keys) {
    if (q === alias) return ALIASES[alias];
    if (q.startsWith(alias + " ")) return ALIASES[alias] + q.slice(alias.length);
    // "cs61a" style: alias immediately followed by a digit
    if (q.startsWith(alias) && /\d/.test(q[alias.length] ?? "")) {
      return ALIASES[alias] + q.slice(alias.length);
    }
  }
  return query;
}