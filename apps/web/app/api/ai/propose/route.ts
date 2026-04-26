import { NextResponse } from "next/server";

/**
 * AI proposal endpoint — stub.
 *
 * Forward the event state + operator intent to the configured provider
 * (Anthropic / OpenAI / etc.) and return a list of `SeatingProposal`s.
 *
 * Not implemented yet. Currently returns 501 so the client provider can
 * surface a clean error message instead of hanging. See `lib/ai/api.ts` and
 * `AI_INTEGRATION.md` for the wiring this should replace.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Not implemented",
      detail:
        "API-mode AI is not wired up in this build. Use 'Auto-seat' / 'Reseat all' for the deterministic local provider, or implement this route against your chosen LLM.",
    },
    { status: 501 },
  );
}
