/**
 * AI provider interface for the seating-assistant flow.
 *
 * Two integration modes are anticipated (see AI_INTEGRATION.md):
 *
 *   1. **Local mode** — a deterministic rule-based assistant. Always present;
 *      no API key required. Today this just delegates to the existing
 *      `autoSeat` helper but in the future it can carry heuristics like
 *      affinity scoring, role mixing, etc.
 *
 *   2. **API mode** — an LLM-backed assistant that proposes placements +
 *      explanations. Implementations live behind a server route so the API
 *      key never reaches the client; the client calls them through this
 *      same interface.
 *
 * Keep the interface narrow: every provider must answer the same question
 * given the same inputs, even if the quality / explanations differ.
 */

import type { EventState } from "../types";
import type { AutoSeatResult } from "../auto-seat";

/** A single concrete proposal the user can accept / reject in one click. */
export interface SeatingProposal {
  /** Stable id so the UI can diff between re-runs. */
  id: string;
  /** Short human-readable label, e.g., "Honor Naomi+Henry's must-sit-with". */
  title: string;
  /** Longer explanation surfaced in a side panel or hover. */
  rationale: string;
  /** The actual placements (seat -> guestId) to apply. */
  placements: AutoSeatResult["placements"];
  /** Guests this proposal could not place, with reasons. */
  unplaced: AutoSeatResult["unplaced"];
}

export interface ProviderContext {
  /** Free-form description from the development officer ("VIP table prefers
   *  major donors near the host", etc.). API-mode providers feed this into
   *  the model prompt; local-mode ignores it for now. */
  intent?: string;
  /** Cancel signal so long-running providers can stop early. */
  signal?: AbortSignal;
}

export interface SeatingProvider {
  /** Stable id, e.g. "local" / "anthropic" / "openai". */
  id: string;
  /** Display name shown in the UI. */
  label: string;
  /** Whether this provider needs network credentials to function. */
  requiresApiKey: boolean;

  /**
   * Suggest one or more proposals against the current event state.
   * Implementations must NOT mutate `state`.
   */
  propose(state: EventState, ctx?: ProviderContext): Promise<SeatingProposal[]>;
}
