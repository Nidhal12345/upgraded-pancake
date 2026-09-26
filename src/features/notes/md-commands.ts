/**
 * Pure markdown editing operations on (text, selection). Each returns the new
 * text and selection so they're trivially testable and undo-friendly
 * (applied via execCommand("insertText") to keep native undo history).
 */
export interface Edit {
  text: string;
  start: number;
  end: number;
}
export interface Change {
  /** Range to replace in the original text. */
  from: number;
  to: number;
  insert: string;
  selStart: number;
  selEnd: number;
}

export function wrap(e: Edit, marker: string, placeholder = "text"): Change {
  const sel = e.text.slice(e.start, e.end);
  const before = e.text.slice(Math.max(0, e.start - marker.length), e.start);
  const after = e.text.slice(e.end, e.end + marker.length);
  // toggle off if already wrapped
  if (before === marker && after === marker) {
    return { from: e.start - marker.length, to: e.end + marker.length, insert: sel, selStart: e.start - marker.length, selEnd: e.end - marker.length };
  }
  const body = sel || placeholder;
  return {
    from: e.start,
    to: e.end,
    insert: `${marker}${body}${marker}`,
    selStart: e.start + marker.length,
    selEnd: e.start + marker.length + body.length,
  };
}

function lineBounds(text: string, start: number, end: number) {
  const ls = text.lastIndexOf("\n", start - 1) + 1;
  let le = text.indexOf("\n", end);
  if (le === -1) le = text.length;
  return { ls, le };
}

/** Toggle a line prefix (heading, list, quote, checkbox) on every selected line. */
export function linePrefix(e: Edit, prefix: string | ((i: number) => string), stripRe: RegExp): Change {
  const { ls, le } = lineBounds(e.text, e.start, e.end);
  const lines = e.text.slice(ls, le).split("\n");
  const p0 = typeof prefix === "function" ? prefix(0) : prefix;
  const allHave = lines.every((l) => l.startsWith(p0.trimEnd()) || (typeof prefix === "function" && /^\d+\. /.test(l)));
  const next = lines.map((l, i) => {
    const bare = l.replace(stripRe, "");
    if (allHave) return bare;
    return (typeof prefix === "function" ? prefix(i) : prefix) + bare;
  });
  const insert = next.join("\n");
  const delta = insert.length - (le - ls);
  return { from: ls, to: le, insert, selStart: lines.length === 1 ? Math.max(ls, e.start + (next[0].length - lines[0].length)) : ls, selEnd: lines.length === 1 ? Math.max(ls, e.end + delta) : ls + insert.length };
}

const LIST_STRIP = /^(\s*)(#{1,6} |> |- \[[ xX]\] |[-*+] |\d+\. )/;

export const cmd = {
  bold: (e: Edit) => wrap(e, "**", "bold text"),
  italic: (e: Edit) => wrap(e, "_", "italic text"),
  strike: (e: Edit) => wrap(e, "~~", "struck text"),
  code: (e: Edit) => wrap(e, "`", "code"),
  heading: (level: 1 | 2 | 3) => (e: Edit) => linePrefix(e, `${"#".repeat(level)} `, LIST_STRIP),
  bullet: (e: Edit) => linePrefix(e, "- ", LIST_STRIP),
  numbered: (e: Edit) => linePrefix(e, (i) => `${i + 1}. `, LIST_STRIP),
  checkbox: (e: Edit) => linePrefix(e, "- [ ] ", LIST_STRIP),
  quote: (e: Edit) => linePrefix(e, "> ", LIST_STRIP),
  link: (e: Edit): Change => {
    const sel = e.text.slice(e.start, e.end);
    const isUrl = /^https?:\/\//.test(sel);
    const label = isUrl ? "link" : sel || "link";
    const url = isUrl ? sel : "https://";
    const insert = `[${label}](${url})`;
    const urlStart = e.start + label.length + 3;
    return { from: e.start, to: e.end, insert, selStart: isUrl || !sel ? e.start + 1 : urlStart, selEnd: isUrl || !sel ? e.start + 1 + label.length : urlStart + url.length };
  },
  insert: (e: Edit, s: string): Change => ({ from: e.start, to: e.end, insert: s, selStart: e.start + s.length, selEnd: e.start + s.length }),
  table: (e: Edit, rows: number, cols: number): Change => {
    const head = `| ${Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(" | ")} |`;
    const sep = `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`;
    const body = Array.from({ length: rows }, () => `| ${Array.from({ length: cols }, () => "   ").join(" | ")} |`).join("\n");
    const needsNl = e.start > 0 && e.text[e.start - 1] !== "\n";
    const pre = needsNl ? "\n\n" : e.start > 0 && e.text[e.start - 2] !== "\n" ? "\n" : "";
    const insert = `${pre}${head}\n${sep}\n${body}\n`;
    const selStart = e.start + pre.length + 2;
    return { from: e.start, to: e.end, insert, selStart, selEnd: selStart + 8 };
  },
};

/**
 * Enter inside a list continues it (or ends it on an empty item).
 * Returns null when the default behaviour should run.
 */
export function continueList(e: Edit): Change | null {
  if (e.start !== e.end) return null;
  const { ls } = lineBounds(e.text, e.start, e.start);
  const line = e.text.slice(ls, e.start);
  const m = line.match(/^(\s*)(- \[[ xX]\] |[-*+] |(\d+)\. |> )(.*)$/);
  if (!m) return null;
  const [, indent, marker, num, rest] = m;
  if (!rest.trim()) {
    // empty item → exit list
    return { from: ls, to: e.start, insert: "", selStart: ls, selEnd: ls };
  }
  let next = marker;
  if (num) next = `${parseInt(num, 10) + 1}. `;
  if (marker.startsWith("- [")) next = "- [ ] ";
  const insert = `\n${indent}${next}`;
  return { from: e.start, to: e.start, insert, selStart: e.start + insert.length, selEnd: e.start + insert.length };
}

/** Toggle the Nth task checkbox in a markdown document (for read mode). */
export function toggleNthCheckbox(md: string, n: number): string {
  let i = -1;
  return md.replace(/^(\s*[-*+] )\[([ xX])\]/gm, (all, pre: string, mark: string) => {
    i++;
    if (i !== n) return all;
    return `${pre}[${mark === " " ? "x" : " "}]`;
  });
}

export function wordCount(s: string) {
  const m = s.replace(/[#>*_~`\-|[\]()]/g, " ").match(/\S+/g);
  return m ? m.length : 0;
}

export function deriveTitle(body: string) {
  const first = body.split("\n").find((l) => l.trim());
  return first ? first.replace(/^#+\s*|[*_~`>]|^-\s(\[.\]\s)?/g, "").trim().slice(0, 80) : "";
}
