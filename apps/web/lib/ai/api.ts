/**
 * API-mode provider stub.
 *
 * Hits a server route at `/api/ai/propose` which is responsible for forwarding
 * the request to the chosen LLM with the operator's API key (kept server-side
 * only). The route is intentionally not implemented yet — this stub exists so
 * the UI can wire to a real interface today and the swap is one file later.
 */

import type { EventState } from "../types";
import type {
  ProviderContext,
  SeatingProposal,
  SeatingProvider,
} from "./types";

export const apiProvider: SeatingProvider = {
  id: "api",
  label: "API mode (server-side LLM)",
  requiresApiKey: true,

  async propose(
    state: EventState,
    ctx?: ProviderContext,
  ): Promise<SeatingProposal[]> {
    const res = await fetch("/api/ai/propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctx?.signal,
      body: JSON.stringify({ state, intent: ctx?.intent }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `AI propose failed (${res.status}): ${detail || res.statusText}`,
      );
    }
    const data = (await res.json()) as { proposals: SeatingProposal[] };
    return data.proposals ?? [];
  },
};
