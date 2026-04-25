/**
 * Lightweight domain types for the canvas-first prototype.
 *
 * These intentionally live in the app, not in @centerpeace/types, until the
 * shape stabilizes. When we add a real DB (M0+), they'll graduate to the
 * shared package and grow Zod schemas alongside.
 */

export type GuestId = string;
export type TableId = string;

export interface Guest {
  id: GuestId;
  /** Full name as it should appear on cards. */
  name: string;
  /** Optional org / role / context the dev team cares about. */
  affiliation?: string;
  /** Free-form notes from the development officer. */
  notes?: string;
}

export type TableShape = "round" | "rect";

export interface CenterpeaceTable {
  id: TableId;
  label: string;
  shape: TableShape;
  /** Number of seats. We render seats deterministically from this + shape. */
  capacity: number;
  /** Center position in canvas coordinates. */
  x: number;
  y: number;
  /** Rotation in degrees (rectangles only; round tables ignore). */
  rotation?: number;
  /** Optional: who hosts / strategic intent. Surfaces in side panel. */
  host?: string;
  purpose?: string;
}

/**
 * A seat is identified by `${tableId}:${index}` where index is 0..capacity-1.
 * We keep seats virtual (no persistent records) and store assignments by key.
 */
export type SeatKey = string;

export const seatKey = (tableId: TableId, index: number): SeatKey =>
  `${tableId}:${index}`;

export const parseSeatKey = (key: SeatKey): { tableId: TableId; index: number } => {
  const colon = key.lastIndexOf(":");
  return {
    tableId: key.slice(0, colon),
    index: Number(key.slice(colon + 1)),
  };
};

/** seatKey -> guestId */
export type SeatAssignments = Record<SeatKey, GuestId>;

export interface EventState {
  id: string;
  name: string;
  guests: Guest[];
  tables: CenterpeaceTable[];
  assignments: SeatAssignments;
}
