/**
 * Grid-sweep placement for newly-added tables.
 *
 * Used when an agent (or the manual "Add table" action) creates one or more
 * tables without specifying coordinates, OR specifies coordinates that
 * collide with existing tables. The strategy: find the bounding box of
 * existing tables, walk a grid of cells outward, and drop each new table
 * into the first cell that doesn't collide with anything else (existing
 * or just-placed).
 *
 * Deterministic, predictable, and looks tidy: rows of tables align like a
 * banquet floor plan rather than landing in a random heap.
 */

import type { CenterpeaceTable, TableShape } from "./types";
import { tableBounds } from "./table-geometry";

/** Outer "footprint" radius of a table — used both for collision and grid cell size. */
function footprintRadius(t: Pick<CenterpeaceTable, "shape" | "capacity">): number {
  // Mirror the geometry helper's bound calculation so the grid cells match
  // the same visual extent the canvas renders.
  const b = tableBounds({
    id: "",
    label: "",
    shape: t.shape,
    capacity: t.capacity,
    x: 0,
    y: 0,
    rotation: 0,
  });
  return b.bound;
}

interface Disc {
  x: number;
  y: number;
  r: number;
}

function collides(a: Disc, b: Disc, padding = 24): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const minDist = a.r + b.r + padding;
  return dx * dx + dy * dy < minDist * minDist;
}

/** Bounds of all existing tables, expanded by their footprints. Returns null when empty. */
function occupiedBounds(existing: CenterpeaceTable[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  if (existing.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const t of existing) {
    const r = footprintRadius(t);
    if (t.x - r < minX) minX = t.x - r;
    if (t.y - r < minY) minY = t.y - r;
    if (t.x + r > maxX) maxX = t.x + r;
    if (t.y + r > maxY) maxY = t.y + r;
  }
  return { minX, minY, maxX, maxY };
}

export interface PlacementInput {
  /** Tables already on the canvas; placement avoids colliding with these. */
  existing: CenterpeaceTable[];
  /** Tables to be placed. Each may carry a desired (x, y); if it collides
   *  or is omitted, we pick the next empty grid cell. */
  pending: Array<{
    shape: TableShape;
    capacity: number;
    x?: number;
    y?: number;
  }>;
}

/**
 * Returns a parallel array of resolved (x, y) positions for `pending`.
 * Existing tables are not moved. Newly-placed tables become obstacles for
 * the next pending table in the same call.
 */
export function placeTables(input: PlacementInput): Array<{ x: number; y: number }> {
  const placed: Disc[] = input.existing.map((t) => ({
    x: t.x,
    y: t.y,
    r: footprintRadius(t),
  }));
  const out: Array<{ x: number; y: number }> = [];

  // Cell size is "biggest table footprint × 2.2"; gives roughly one row of
  // tables per grid row with some breathing room.
  const maxR = Math.max(
    ...placed.map((d) => d.r),
    ...input.pending.map((p) => footprintRadius(p)),
    80,
  );
  const cell = Math.ceil(maxR * 2.2);

  // Where do we start the sweep? If there are existing tables, just to the
  // right of their bounding box, aligned to the top edge so new rows grow
  // downward. With an empty canvas, start at the origin.
  const ob = occupiedBounds(input.existing);
  const startX = ob ? ob.maxX + maxR : 0;
  const startY = ob ? ob.minY + maxR : 0;

  for (const p of input.pending) {
    const r = footprintRadius(p);
    const candidate: Disc = { x: 0, y: 0, r };

    // 1) If the agent gave a position and it's clear, use it verbatim.
    if (typeof p.x === "number" && typeof p.y === "number") {
      candidate.x = p.x;
      candidate.y = p.y;
      const conflict = placed.some((d) => collides(d, candidate));
      if (!conflict) {
        placed.push(candidate);
        out.push({ x: candidate.x, y: candidate.y });
        continue;
      }
      // Collides — fall through to grid sweep.
    }

    // 2) Sweep a row-major grid starting from the corner. We grow rows
    // rightward and only bump down when a row fills up. Bounded sweep so
    // we don't infinite-loop on a degenerate input.
    let placedThisOne = false;
    sweep: for (let row = 0; row < 200; row++) {
      for (let col = 0; col < 200; col++) {
        candidate.x = startX + col * cell;
        candidate.y = startY + row * cell;
        const conflict = placed.some((d) => collides(d, candidate));
        if (!conflict) {
          placed.push({ ...candidate });
          out.push({ x: candidate.x, y: candidate.y });
          placedThisOne = true;
          break sweep;
        }
      }
    }
    if (!placedThisOne) {
      // Very unlikely fallback: stack at the right of the occupied area
      // with a vertical offset that grows per overflow.
      const fallbackY = startY + (out.length + 1) * cell;
      placed.push({ x: startX, y: fallbackY, r });
      out.push({ x: startX, y: fallbackY });
    }
  }

  return out;
}
