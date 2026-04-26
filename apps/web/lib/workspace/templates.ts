/**
 * Static text templates shipped into a freshly-bootstrapped workspace.
 *
 * These are inlined as TS modules (not files read from disk) so they ship
 * cleanly through the Next.js build and can be deployed without separate
 * asset bundling. The strings are deliberately short — agents read them.
 */

/** The agent-facing system prompt. README is the agent's instruction manual. */
export const README = `# Centerpeace Agent Workspace

You are an AI agent helping a nonprofit team build a seating chart for an
event. The team is using Centerpeace, an open-source seating tool, and has
configured this folder as your shared workspace.

## How this works

- Centerpeace writes the event's current state into this folder. You read it.
- When the team wants your help, they generate a **request** file in
  \`requests/\`. You read the latest one, do the work, and write a **response**
  to \`responses/\` matching the schema at \`schemas/response.schema.json\`.
- Centerpeace watches \`responses/\` and surfaces your proposal in the canvas
  for the team to accept or reject. You never directly modify the chart.

## File map

| Path | What it is |
|---|---|
| \`current-state.json\` | Authoritative live state. App-managed; do not edit. |
| \`guests.csv\` | Human-readable guest list. App-managed. |
| \`tables.md\` | Current seating, human-readable. App-managed. |
| \`constraints.md\` | Hard and soft constraints. App-managed. |
| \`org-context.md\` | **Read this first.** Org's persistent strategic context. |
| \`session.json\` | Last 10 request/response pairs for continuity. |
| \`requests/\` | App writes here. You read. |
| \`responses/\` | You write here. App reads. |
| \`schemas/\` | JSON Schema definitions and worked examples. |

## Hard rules

1. Never edit app-managed files. Only write to \`responses/\` and
   \`proposed-changes/\`.
2. Every \`proposedAssignment\` must include a \`reasoning\` field. The team
   sees it.
3. Respect \`must_not_sit_with\` constraints. Violations are flagged red and
   will likely be rejected.
4. Do not move guests in seats marked \`locked: true\`.
5. Match the schema exactly. The app validates and rejects malformed JSON.

## Soft guidance

- Read \`org-context.md\` before every request. It carries philosophy that
  doesn't fit in CSV columns.
- Read \`session.json\` to understand what's already been tried.
- When unsure, leave a \`warning\` in the response rather than guessing.
- Briefer is better. 200 words of reasoning beats 2000.

## Getting started

When the team says "process the latest request", look in \`requests/\`,
pick the newest file, follow its instructions, and write the response.
`;

/** Default guidance for the org-context file. Owned by the team thereafter. */
export const ORG_CONTEXT = `# Organization Context

This file is yours. Centerpeace will never overwrite it.

Use it to capture the strategic intelligence that doesn't fit in your CRM
columns: donor tier philosophy, table strategy, recurring relationship
flags, leadership preferences, and any internal vocabulary the agent should
understand.

A well-maintained org-context is the single biggest lever you have for
making AI seating suggestions feel right.

## Donor tier definitions

(Describe how you label donors and what each label means strategically.)

## Table strategy philosophy

(Describe how you compose tables. Who goes near the CEO. How you mix
donor stages. How first-timers are integrated.)

## Recurring relationship flags

(People or pairs that carry context across every event — feuds, close
friendships, sensitivities not captured in the CRM.)

## Leadership preferences

(Standing preferences from the ED, board chair, or other principals.)

## Vocabulary

(Internal terminology — "table host", "ask table", org-specific acronyms.)
`;

/** .gitignore so accidental git init in the workspace doesn't leak guest data. */
export const GITIGNORE = `# Centerpeace workspace — guest data should NEVER be committed.
current-state.json
guests.csv
tables.md
constraints.md
session.json
requests/
responses/
proposed-changes/
archive/

# Org-context is intentionally NOT ignored — it's safe to commit if your
# team wants to track strategy across events. Comment out the next line to
# also exclude it.
# org-context.md
`;

/** JSON Schema for response files. Pinned to spec v1.0. */
export const RESPONSE_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://centerpeace.app/schemas/response.schema.json",
  title: "CenterpeaceAgentResponse",
  type: "object",
  required: ["specVersion", "requestId", "type", "generatedAt", "summary"],
  properties: {
    specVersion: { const: "1.0" },
    requestId: { type: "string" },
    type: {
      enum: [
        "suggest-arrangement",
        "review-table",
        "find-conflicts",
        "explain-arrangement",
        "propose-constraint",
      ],
    },
    generatedAt: { type: "string", format: "date-time" },
    agent: { type: "string" },
    summary: { type: "string" },
    proposedAssignments: {
      type: "array",
      items: {
        type: "object",
        required: ["guestId", "tableId", "seatIndex", "reasoning"],
        properties: {
          guestId: { type: "string" },
          tableId: { type: "string" },
          seatIndex: { type: "integer", minimum: 0 },
          displaces: { type: ["string", "null"] },
          reasoning: { type: "string" },
        },
      },
    },
    proposedConstraints: {
      type: "array",
      items: {
        type: "object",
        required: ["relationship", "reason"],
        properties: {
          guestAId: { type: ["string", "null"] },
          guestBId: { type: ["string", "null"] },
          tableId: { type: ["string", "null"] },
          relationship: {
            enum: ["must_sit_with", "must_not_sit_with", "prefer_table"],
          },
          reason: { type: "string" },
          derivedFrom: { type: "string" },
        },
      },
    },
    explanation: { type: "string" },
    warnings: {
      type: "array",
      items: {
        type: "object",
        required: ["level", "message"],
        properties: {
          level: { enum: ["info", "warning", "error"] },
          message: { type: "string" },
        },
      },
    },
    unfulfilledRequests: { type: "array", items: { type: "string" } },
  },
} as const;

/** JSON Schema for request files. Lighter — frontmatter mostly. */
export const REQUEST_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://centerpeace.app/schemas/request.schema.json",
  title: "CenterpeaceAgentRequest",
  type: "object",
  required: ["specVersion", "requestId", "type", "createdAt"],
  properties: {
    specVersion: { const: "1.0" },
    requestId: { type: "string" },
    type: {
      enum: [
        "suggest-arrangement",
        "review-table",
        "find-conflicts",
        "explain-arrangement",
        "propose-constraint",
      ],
    },
    createdAt: { type: "string", format: "date-time" },
    scope: { type: "object", additionalProperties: true },
  },
} as const;

/** A worked example response so the agent has a concrete pattern. */
export const EXAMPLE_RESPONSE = `{
  "specVersion": "1.0",
  "requestId": "req_example",
  "type": "suggest-arrangement",
  "generatedAt": "2026-04-26T12:00:00Z",
  "agent": "claude-cowork",
  "summary": "Placed 2 unseated guests at Table 3, prioritizing the must-sit-with constraint.",
  "proposedAssignments": [
    {
      "guestId": "g_001",
      "tableId": "t_3",
      "seatIndex": 2,
      "displaces": null,
      "reasoning": "Spouse of g_002 (must_sit_with). Table 3 has the only adjacent open seats."
    },
    {
      "guestId": "g_002",
      "tableId": "t_3",
      "seatIndex": 3,
      "displaces": null,
      "reasoning": "Pairs with g_001 per must_sit_with."
    }
  ],
  "warnings": [],
  "unfulfilledRequests": []
}
`;
