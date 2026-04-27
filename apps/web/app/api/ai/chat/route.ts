/**
 * BYOK chat endpoint.
 *
 * The browser holds the API key (in localStorage) and sends it on each
 * request. Server constructs a provider client per-request, never persists
 * the key, never logs it. Response streams via the AI SDK's standard
 * `toDataStreamResponse()` so the client `useChat` hook handles it natively.
 *
 * Tools are declared without `execute`, which makes them client-side: the
 * browser receives `tool-call` events, runs `applyChange` on the local
 * store, and replies with the tool result. This keeps the source of truth
 * in the canvas and avoids the server keeping any per-event state.
 */

import { streamText, tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  provider: "anthropic" | "openai";
  model: string;
  apiKey: string;
  /** Snapshot of the current event state, used as system context. */
  state: {
    name: string;
    guests: Array<{ id: string; name: string; affiliation?: string; notes?: string }>;
    tables: Array<{ id: string; label: string; capacity: number; shape: string }>;
    assignments: Record<string, string>;
    constraints: Array<{ id: string; kind: string; a: string; b: string; note?: string }>;
  };
  /** Optional org-context document shipped from the workspace. */
  orgContext?: string;
}

function buildSystemPrompt(body: ChatBody): string {
  const { state, orgContext } = body;
  const seated = Object.keys(state.assignments).length;
  const total = state.guests.length;
  const lines: string[] = [
    "You are an AI assistant inside Centerpeace, an open-source seating chart tool for nonprofit fundraising events.",
    "Your job is to help the development officer arrange seats. The human can drag-and-drop themselves; you save them time on bulk and reasoning-heavy work.",
    "",
    `Event: ${state.name} \u00b7 ${total} guests \u00b7 ${state.tables.length} tables \u00b7 ${seated} seated.`,
    "",
    "When you need to change the chart, call the `apply_change` tool. Each call is applied immediately and a version snapshot is taken first, so the human can undo via the History menu. Never call `apply_change` more than once per response — batch all changes into one payload.",
    "",
    "Always include a one-sentence `note` summarising what you did and why. The human sees this in a toast.",
    "",
    "Respect existing must-not-sit-with constraints. If the human asks for something that violates them, point it out and ask for confirmation before applying.",
    "",
    "Reference seats with the format `<tableId>:<seatIndex>` (e.g. `t_3:0`). Indexes are 0-based.",
    "",
    "When adding tables, OMIT `x` and `y` unless the user has been specific about location. Centerpeace runs a grid packer that lays new tables out in a tidy row next to the existing chart automatically — much better than guessing coordinates that will collide.",
    "",
    "Current state (compact JSON):",
    JSON.stringify(
      {
        guests: state.guests,
        tables: state.tables,
        assignments: state.assignments,
        constraints: state.constraints,
      },
      null,
      0,
    ),
  ];
  if (orgContext) {
    lines.push("", "Organization context (from org-context.md):", orgContext);
  }
  return lines.join("\n");
}

const applyChangeSchema = z.object({
  note: z
    .string()
    .describe(
      "One-sentence summary of what you're changing and why. The user will see this.",
    ),
  assignments: z
    .record(z.string().regex(/^[^:]+:[0-9]+$/), z.string())
    .optional()
    .describe(
      "Map of '<tableId>:<seatIndex>' to guestId. Overwrites whatever was there.",
    ),
  removeAssignments: z
    .array(z.string().regex(/^[^:]+:[0-9]+$/))
    .optional()
    .describe("Seats to clear."),
  addConstraints: z
    .array(
      z.object({
        kind: z.enum(["must-sit-with", "must-not-sit-with"]),
        guestAId: z.string(),
        guestBId: z.string(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  removeConstraints: z.array(z.string()).optional().describe("Constraint IDs to remove."),
  addTables: z
    .array(
      z.object({
        label: z.string().optional(),
        shape: z.enum(["round", "rect"]).optional(),
        capacity: z.number().int().min(1).max(24).optional(),
        x: z
          .number()
          .optional()
          .describe(
            "Optional. Omit unless the user is explicit about location — Centerpeace will auto-place the table on a grid next to existing tables.",
          ),
        y: z.number().optional(),
        rotation: z.number().optional(),
      }),
    )
    .optional()
    .describe(
      "New tables to add. Coordinates are optional; Centerpeace runs a grid packer when omitted.",
    ),
  removeTables: z
    .array(z.string())
    .optional()
    .describe(
      "IDs of tables to delete. Any seat assignments at those tables are also cleared.",
    ),
  updateTables: z
    .record(
      z.string(),
      z.object({
        label: z.string().optional(),
        shape: z.enum(["round", "rect"]).optional(),
        capacity: z.number().int().min(1).max(24).optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        rotation: z.number().optional(),
      }),
    )
    .optional()
    .describe("Patches keyed by table ID (relabel, resize, move, rotate)."),
});

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body.apiKey) {
    return new Response("Missing apiKey", { status: 401 });
  }
  if (!body.provider || !body.model) {
    return new Response("Missing provider or model", { status: 400 });
  }

  // Build the model. The provider client only lives for the duration of
  // this request — the key is never written to disk or kept in memory
  // beyond this scope.
  const model =
    body.provider === "anthropic"
      ? createAnthropic({ apiKey: body.apiKey })(body.model)
      : createOpenAI({ apiKey: body.apiKey })(body.model);

  const result = streamText({
    model,
    system: buildSystemPrompt(body),
    messages: body.messages,
    tools: {
      apply_change: tool({
        description:
          "Apply a batch of seat assignments and/or constraint edits. Centerpeace snapshots a version before applying. Use this sparingly: at most once per response, batched.",
        inputSchema: applyChangeSchema,
        // No `execute` — the browser handles this tool client-side via
        // useChat's onToolCall hook.
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
