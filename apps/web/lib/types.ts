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
  /** Display label, e.g., "Table 1" or "Head table". */
  label: string;
  shape: TableShape;
  /** Number of seats. For 'rect' must be even (split across the two long sides). */
  capacity: number;
  /** Center point in world coordinates on the canvas. */
  x: number;
  y: number;
  /** Rotation in radians, applied around the center. 0 = long axis horizontal. */
  rotation: number;
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

/**
 * Binary constraints between two guests. Kept intentionally narrow for v0:
 * just hard "must / must-not" pairs on the same table. Soft preferences
 * (prefer-near / avoid-near) and group constraints come once these feel right.
 */
export type ConstraintKind = "must-sit-with" | "must-not-sit-with";

export interface Constraint {
  id: string;
  kind: ConstraintKind;
  a: GuestId;
  b: GuestId;
  /** Optional context the dev officer adds at creation time. */
  note?: string;
}

/** Status computed from current assignments. */
export type ConstraintStatus = "satisfied" | "violated" | "pending";

export interface EvaluatedConstraint extends Constraint {
  status: ConstraintStatus;
  /** Seat keys when both guests are seated, useful for drawing lines. */
  seatA?: SeatKey;
  seatB?: SeatKey;
}

export interface EventState {
  id: string;
  name: string;
  guests: Guest[];
  tables: CenterpeaceTable[];
  assignments: SeatAssignments;
  constraints: Constraint[];
}
