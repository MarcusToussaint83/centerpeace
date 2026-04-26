/**
 * Local (deterministic) seating provider.
 *
 * Wraps the existing `autoSeat` helper as a single proposal. This is the
 * baseline every API-mode provider must beat — and it ships in every install
 * with zero configuration.
 */

import { autoSeat } from "../auto-seat";
import type { EventState } from "../types";
import type { SeatingProposal, SeatingProvider } from "./types";

export const localProvider: SeatingProvider = {
  id: "local",
  label: "Local (deterministic)",
  requiresApiKey: false,

  async propose(state: EventState): Promise<SeatingProposal[]> {
    const r = autoSeat(state);
    if (Object.keys(r.placements).length === 0) return [];
    return [
      {
        id: "local:auto-seat",
        title: "Place all unseated, respecting hard constraints",
        rationale:
          "Greedy placer that clusters guests by must-sit-with, picks the table " +
          "with the most open seats and no must-not-sit-with conflicts. " +
          "Doesn't disturb anyone already seated.",
        placements: r.placements,
        unplaced: r.unplaced,
      },
    ];
  },
};
