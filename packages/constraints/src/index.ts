/**
 * @centerpeace/constraints
 *
 * Pure-function constraint solver. No I/O, no side effects.
 * Lands in Milestone 6 of the build plan; this placeholder reserves the
 * package boundary so the rest of the codebase can import the eventual API.
 */

export type ConstraintKind =
  | "must-sit-with"
  | "must-not-sit-with"
  | "prefer-near"
  | "locked-seat"
  | "table-capacity"
  | "accessibility";

export const PLACEHOLDER = true;
