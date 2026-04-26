/**
 * Export utilities for Centerpeace seating charts.
 *
 * PNG  — rasterises the Konva stage at 2× resolution for crisp prints.
 * CSV  — table-by-table guest list suitable for place-card printing.
 */

import type Konva from "konva";
import type { EventState } from "./types";

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

/** Download the full canvas as a PNG at `pixelRatio` resolution. */
export function exportPNG(stage: Konva.Stage, eventName: string, pixelRatio = 2) {
  const dataURL = stage.toDataURL({ pixelRatio, mimeType: "image/png" });
  triggerDownload(dataURL, `${slugify(eventName)}-seating-chart.png`);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Build and download a CSV with one row per seat, grouped by table.
 * Columns: Table, Seat #, Guest Name, Affiliation, Notes
 */
export function exportCSV(state: Pick<EventState, "name" | "guests" | "tables" | "assignments">) {
  const guestMap = new Map(state.guests.map((g) => [g.id, g]));

  const rows: string[][] = [["Table", "Seat", "Guest Name", "Affiliation", "Notes"]];

  for (const table of state.tables) {
    const seats = table.capacity;
    for (let i = 0; i < seats; i++) {
      const key = `${table.id}:${i}`;
      const guestId = state.assignments[key];
      const guest = guestId ? guestMap.get(guestId) : undefined;
      rows.push([
        table.label || `Table ${table.id.slice(0, 6)}`,
        String(i + 1),
        guest?.name ?? "",
        guest?.affiliation ?? "",
        guest?.notes ?? "",
      ]);
    }
  }

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${slugify(state.name)}-guest-list.csv`);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "event";
}

function csvCell(val: string) {
  if (/[",\r\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}
