/**
 * Shape-aware seat / table geometry.
 *
 * Single source of truth for:
 *   - the visual size of a table (used by the canvas renderer)
 *   - the world position of each seat (used by both seat rendering and
 *     constraint-line drawing)
 *
 * Keep this file framework-free; the canvas imports it and so do tests later.
 */

import { seatKey, type CenterpeaceTable, type SeatKey } from "./types";

/** How far seat centers sit outside the tabletop edge. */
export const SEAT_OFFSET = 26;

/** Radius for round tables, mildly grows past 8 seats. */
export function roundRadius(capacity: number): number {
  return 70 + Math.max(0, capacity - 8) * 6;
}

/** Width = the short axis (across), length = long axis. Both before rotation. */
export function rectDimensions(capacity: number): { length: number; width: number } {
  // Two seats per long-side slot; clamp to a banquet-table feel.
  const perSide = Math.max(2, Math.ceil(capacity / 2));
  const length = perSide * 60 + 40;
  return { length, width: 90 };
}

export interface TableBounds {
  /** Maximum extent (radius for round, half-diagonal-ish for rect) used
   *  by the renderer for hit areas / culling. */
  bound: number;
  /** Local-space points needed to draw the table shape, before rotation. */
  shape:
    | { kind: "round"; radius: number }
    | { kind: "rect"; length: number; width: number };
}

export function tableBounds(table: CenterpeaceTable): TableBounds {
  if (table.shape === "round") {
    const r = roundRadius(table.capacity);
    return { bound: r + SEAT_OFFSET + 16, shape: { kind: "round", radius: r } };
  }
  const { length, width } = rectDimensions(table.capacity);
  const halfDiag = Math.sqrt(length * length + width * width) / 2;
  return { bound: halfDiag + SEAT_OFFSET + 16, shape: { kind: "rect", length, width } };
}

/** Apply table rotation around its center to a local-space point. */
function rotate(local: { x: number; y: number }, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: local.x * c - local.y * s, y: local.x * s + local.y * c };
}

/**
 * Local seat position (before applying table position and rotation).
 *
 * Round: evenly distributed on a circle, seat 0 at "12 o'clock".
 * Rect:  seats walk the long sides. First half on top edge left→right,
 *        second half on bottom edge right→left so adjacent indexes are
 *        physically adjacent (or directly across at the corner).
 */
export function localSeatPosition(
  table: CenterpeaceTable,
  index: number,
): { x: number; y: number } {
  if (table.shape === "round") {
    const r = roundRadius(table.capacity) + SEAT_OFFSET;
    const angle = (index / table.capacity) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  }
  const { length, width } = rectDimensions(table.capacity);
  const perSide = Math.ceil(table.capacity / 2);
  const slotLen = length / perSide;
  if (index < perSide) {
    // Top edge, left to right
    const x = -length / 2 + slotLen * (index + 0.5);
    const y = -width / 2 - SEAT_OFFSET;
    return { x, y };
  }
  // Bottom edge, right to left
  const j = index - perSide;
  const x = length / 2 - slotLen * (j + 0.5);
  const y = width / 2 + SEAT_OFFSET;
  return { x, y };
}

/** World-space seat position (table position + rotation applied). */
export function worldSeatPosition(
  table: CenterpeaceTable,
  index: number,
): { x: number; y: number } {
  const local = localSeatPosition(table, index);
  const r = rotate(local, table.rotation);
  return { x: table.x + r.x, y: table.y + r.y };
}

/**
 * Find the seat closest to a world point, within `maxDistance`.
 * Returns the seat key or null if nothing is close enough.
 *
 * Used for drop-target resolution when dragging a guest from the panel.
 */
export function findNearestSeat(
  tables: CenterpeaceTable[],
  worldX: number,
  worldY: number,
  maxDistance: number,
): SeatKey | null {
  let best: { key: SeatKey; d2: number } | null = null;
  const maxD2 = maxDistance * maxDistance;
  for (const table of tables) {
    // Cheap bounding-box cull: if point is far from the table center, skip.
    const dx = worldX - table.x;
    const dy = worldY - table.y;
    // Loose radius covers seats (farthest seat from center + threshold).
    const approx = Math.hypot(dx, dy);
    if (approx > (SEAT_OFFSET + 200)) continue;
    for (let i = 0; i < table.capacity; i++) {
      const p = worldSeatPosition(table, i);
      const d2 = (p.x - worldX) ** 2 + (p.y - worldY) ** 2;
      if (d2 <= maxD2 && (!best || d2 < best.d2)) {
        best = { key: seatKey(table.id, i), d2 };
      }
    }
  }
  return best?.key ?? null;
}
