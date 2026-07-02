/**
 * Prefix Trie for search autocomplete
 * ====================================
 * Nodes are keyed by character. Word-ending nodes store the term to display
 * plus a weight used to rank suggestions.
 *
 * Why a trie instead of filtering an array?
 *  - Suggestion lookup is O(p + k): walk p characters to the prefix node,
 *    then collect k results below it — independent of total term count.
 *    A linear scan is O(n · p) on every keystroke.
 *  - With ~740 courses this is admittedly more about correctness of design
 *    than raw speed, but it gives weighted ranking + prefix completion
 *    cleanly and stays fast as the catalog grows.
 *
 * The insert key and the returned term are separated so we can index a
 * course under multiple keys — e.g. walking "61a" returns "CS 61A".
 */

interface TrieNode {
  children: Map<string, TrieNode>;
  /** Terms completed at this node (term display string -> weight). */
  terms: Map<string, number> | null;
}

function makeNode(): TrieNode {
  return { children: new Map(), terms: null };
}

export class Trie {
  private root: TrieNode = makeNode();

  /**
   * Insert `term` reachable by typing `key`.
   * If the same key/term pair is inserted twice, the max weight wins.
   */
  insert(key: string, term: string, weight = 1): void {
    const k = key.toLowerCase();
    let node = this.root;
    for (const ch of k) {
      if (!node.children.has(ch)) node.children.set(ch, makeNode());
      node = node.children.get(ch)!;
    }
    if (!node.terms) node.terms = new Map();
    node.terms.set(term, Math.max(node.terms.get(term) ?? 0, weight));
  }

  /**
   * Up to `limit` distinct terms whose key starts with `prefix`,
   * ranked by weight desc, then alphabetically. O(p + subtree).
   */
  suggest(prefix: string, limit = 6): string[] {
    const key = prefix.toLowerCase().trim();
    if (!key) return [];

    let node = this.root;
    for (const ch of key) {
      const next = node.children.get(ch);
      if (!next) return [];
      node = next;
    }

    // Collect all completed terms in the subtree (DFS), dedup by max weight
    const best = new Map<string, number>();
    const stack: TrieNode[] = [node];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.terms) {
        for (const [term, w] of n.terms) {
          best.set(term, Math.max(best.get(term) ?? 0, w));
        }
      }
      for (const child of n.children.values()) stack.push(child);
    }

    return [...best.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([term]) => term);
  }
}

/**
 * Build the autocomplete trie from course data. Each course is indexed by:
 *  - its display code ("CS 61A"), weight 100
 *  - its code without spaces ("cs61a"), weight 100
 *  - its bare number ("61a" -> "CS 61A"), weight 60
 *  - each title word of length >= 4, weight 10
 */
export function buildCourseTrie(
  courses: { displayCode: string; title: string }[]
): Trie {
  const trie = new Trie();
  for (const c of courses) {
    trie.insert(c.displayCode, c.displayCode, 100);
    trie.insert(c.displayCode.replace(/\s+/g, ""), c.displayCode, 100);

    const numPart = c.displayCode.split(/\s+/).pop();
    if (numPart && numPart !== c.displayCode) {
      trie.insert(numPart, c.displayCode, 60);
    }

    for (const word of c.title.split(/[^a-zA-Z0-9]+/)) {
      if (word.length >= 4) trie.insert(word, word.toLowerCase(), 10);
    }
  }
  return trie;
}
