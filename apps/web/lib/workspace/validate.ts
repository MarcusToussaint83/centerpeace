/**
 * Validate agent response files against schema + current event state.
 *
 * Two layers:
 *  1. JSON Schema (Ajv) — structural validity.
 *  2. Reference validity — every guestId/tableId/seatIndex points at
 *     something real in the live state, and `displaces` matches.
 */

import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { RESPONSE_SCHEMA } from "./templates";
import type { EventState } from "../types";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema: ValidateFunction = ajv.compile(RESPONSE_SCHEMA);

export interface ProposedAssignment {
  guestId: string;
  tableId: string;
  seatIndex: number;
  displaces?: string | null;
  reasoning: string;
}

export interface AgentResponse {
  specVersion: string;
  requestId: string;
  type: string;
  generatedAt: string;
  agent?: string;
  summary: string;
  proposedAssignments?: ProposedAssignment[];
  proposedConstraints?: Array<{
    guestAId?: string | null;
    guestBId?: string | null;
    tableId?: string | null;
    relationship: "must_sit_with" | "must_not_sit_with" | "prefer_table";
    reason: string;
    derivedFrom?: string;
  }>;
  explanation?: string;
  warnings?: Array<{ level: "info" | "warning" | "error"; message: string }>;
  unfulfilledRequests?: string[];
}

export type ValidationResult =
  | { ok: true; response: AgentResponse }
  | { ok: false; errors: string[] };

/** Schema-only validation. Reference checks happen client-side against live state. */
export function validateResponse(raw: unknown): ValidationResult {
  if (!validateSchema(raw)) {
    const errors = (validateSchema.errors ?? []).map(
      (e) => `${e.instancePath || "<root>"} ${e.message ?? "invalid"}`,
    );
    return { ok: false, errors };
  }
  return { ok: true, response: raw as AgentResponse };
}

/**
 * Optional second pass: ensure every proposed move references real entities
 * and that `displaces` actually matches the current occupant of that seat.
 *
 * Returns a list of human-readable issues; empty list means all good.
 */
export function validateReferences(
  response: AgentResponse,
  state: Pick<EventState, "guests" | "tables" | "assignments" | "constraints">,
): string[] {
  const issues: string[] = [];
  const guestIds = new Set(state.guests.map((g) => g.id));
  const tableById = new Map(state.tables.map((t) => [t.id, t]));

  for (const a of response.proposedAssignments ?? []) {
    if (!guestIds.has(a.guestId)) {
      issues.push(`Unknown guest ${a.guestId}`);
      continue;
    }
    const table = tableById.get(a.tableId);
    if (!table) {
      issues.push(`Unknown table ${a.tableId}`);
      continue;
    }
    if (a.seatIndex < 0 || a.seatIndex >= table.capacity) {
      issues.push(
        `Seat ${a.seatIndex + 1} out of range for ${table.label} (1..${table.capacity})`,
      );
      continue;
    }
    const occupied = state.assignments[`${a.tableId}:${a.seatIndex}`];
    if (a.displaces && occupied !== a.displaces) {
      issues.push(
        `displaces mismatch at ${table.label} seat ${a.seatIndex + 1}: ` +
          `expected ${a.displaces}, actual ${occupied ?? "empty"}`,
      );
    }
  }
  return issues;
}
