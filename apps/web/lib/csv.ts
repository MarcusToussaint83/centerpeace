/**
 * Minimal CSV parser for the guest-import flow.
 *
 * Handles:
 *   - quoted fields with embedded commas and newlines
 *   - escaped quotes ("")
 *   - mixed line endings
 *   - a header row (case-insensitive match against known column names)
 *
 * Falls back to one-name-per-line when there are no commas at all, which is
 * the most common copy-paste shape.
 */

export interface GuestRow {
  name: string;
  affiliation?: string;
  notes?: string;
}

export interface ParseResult {
  rows: GuestRow[];
  /** Lines we couldn't make sense of (e.g., header-only or blank). */
  skipped: number;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"' && cur === "") {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function tokenizeLines(text: string): string[] {
  // Walk the text honoring quoted strings so embedded \n survives.
  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') inQuotes = !inQuotes;
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (cur) lines.push(cur);
      cur = "";
      // collapse \r\n
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const NAME_HEADERS = new Set(["name", "guest", "guest name", "full name"]);
const AFFILIATION_HEADERS = new Set([
  "affiliation",
  "org",
  "organization",
  "company",
  "role",
  "title",
]);
const NOTES_HEADERS = new Set(["notes", "note", "comment", "comments"]);

export function parseGuestsCSV(text: string): ParseResult {
  const lines = tokenizeLines(text).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { rows: [], skipped: 0 };

  const hasCommas = lines.some((l) => l.includes(","));
  if (!hasCommas) {
    // Plaintext list, one name per line.
    return {
      rows: lines.map((name) => ({ name: name.trim() })).filter((r) => r.name),
      skipped: 0,
    };
  }

  const firstCells = splitCsvLine(lines[0]!).map((c) => c.toLowerCase());
  const looksLikeHeader = firstCells.some(
    (c) => NAME_HEADERS.has(c) || AFFILIATION_HEADERS.has(c) || NOTES_HEADERS.has(c),
  );

  let nameIdx = 0;
  let affIdx = 1;
  let notesIdx = 2;
  let dataStart = 0;
  if (looksLikeHeader) {
    nameIdx = firstCells.findIndex((c) => NAME_HEADERS.has(c));
    affIdx = firstCells.findIndex((c) => AFFILIATION_HEADERS.has(c));
    notesIdx = firstCells.findIndex((c) => NOTES_HEADERS.has(c));
    if (nameIdx < 0) nameIdx = 0;
    dataStart = 1;
  }

  let skipped = 0;
  const rows: GuestRow[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const name = cells[nameIdx]?.trim() ?? "";
    if (!name) {
      skipped++;
      continue;
    }
    rows.push({
      name,
      affiliation: affIdx >= 0 ? cells[affIdx]?.trim() || undefined : undefined,
      notes: notesIdx >= 0 ? cells[notesIdx]?.trim() || undefined : undefined,
    });
  }
  return { rows, skipped };
}
