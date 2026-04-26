/**
 * Static text templates shipped into a freshly-bootstrapped workspace.
 *
 * The protocol is deliberately small. The agent reads the live event state
 * from the files in the workspace root, then drops a single JSON file in
 * `proposed-changes/` to apply changes. Centerpeace watches that folder,
 * snapshots a version, applies the change, archives the file. There is no
 * request/response handshake — the human asks the agent in the agent's own
 * UX, and the agent operates on the workspace.
 */

/** Agent-facing onboarding doc + system prompt at the root of the workspace. */
export const README = `# Centerpeace Agent Workspace

This folder is a shared canvas between an AI agent and a development team
working on a nonprofit fundraising seating chart. Centerpeace (the app)
syncs the live event state here as you work. Your agent reads these files
and writes back changes. Centerpeace renders the result.

---

## For the human: how to connect your agent

This folder works with any tool that can read and write local files:
**Claude Code**, **Claude Cowork (claude.ai/cowork)**, **Cursor**,
**Aider**, ChatGPT desktop with the file connector, etc.

### One-time setup (Claude Code or Cowork)

1. Open your agent of choice.
2. Tell it to work in **this folder** (in Claude Code: \`cd\` here and run
   \`claude\`. In Cowork: drag this folder into the project picker).
3. Paste the system prompt below as the agent's first message.
4. Then ask for what you need in plain English. Examples:
   - "Populate the tables. Big donors near Table 1. Spouses together."
   - "Find any constraint violations and fix them with minimal moves."
   - "Move Sarah Chen to Table 3."
   - "Explain why Table 7 is laid out this way."

### Copy-paste this system prompt for your agent

> You are working in a Centerpeace agent workspace. Read \`README.md\` for
> the file map and protocol. Read \`org-context.md\` for the team's
> strategic preferences. Read \`current-state.json\` for the live event
> state. Make changes by writing a single JSON file into
> \`proposed-changes/\` matching \`schemas/apply.schema.json\`. Centerpeace
> watches that folder and applies your changes automatically — there is no
> approval step, so be careful. The human reviews on the canvas and undoes
> via the History menu if needed. Always include a one-sentence \`note\`
> field summarising what you did and why.

---

## For the agent: protocol

### Files Centerpeace writes (you read these — never edit)

| Path | Contents |
|---|---|
| \`current-state.json\` | Authoritative live state. Always fresh. |
| \`guests.csv\` | Human-readable guest list. |
| \`tables.md\` | Current seating, rendered for humans. |
| \`constraints.md\` | Hard relationship rules. |
| \`org-context.md\` | **Read this first.** Org's persistent strategy. |
| \`session.json\` | Last 10 changes applied. Use for continuity. |
| \`schemas/apply.schema.json\` | The schema your output must match. |
| \`schemas/examples/\` | Worked examples. |

### Files you write

Drop a JSON file into \`proposed-changes/\`. Filename can be anything
ending in \`.json\` — Centerpeace processes by mtime. After it applies your
change, the file moves to \`archive/<year>/<month>/\`. Malformed files
go to the same archive with a \`.invalid\` suffix.

### The apply schema

\`\`\`json
{
  "specVersion": "1.0",
  "agent": "claude-cowork",
  "note": "One-sentence summary the human sees in a toast.",
  "assignments": {
    "<tableId>:<seatIndex>": "<guestId>"
  },
  "removeAssignments": ["<tableId>:<seatIndex>"],
  "addConstraints": [
    {
      "kind": "must-sit-with" | "must-not-sit-with",
      "guestAId": "<guestId>",
      "guestBId": "<guestId>",
      "note": "Why."
    }
  ],
  "removeConstraints": ["<constraintId>"]
}
\`\`\`

All operation arrays are optional. \`assignments\` overwrites whatever was
at that seat — and Centerpeace will pull the guest from any prior seat,
so you don't need to write a paired \`removeAssignments\`.

### Hard rules

1. Read \`org-context.md\` and \`current-state.json\` before acting.
2. Respect existing \`must-not-sit-with\` constraints. Violations are
   flagged red on the canvas and will probably be undone.
3. The \`note\` field is one sentence. Longer reasoning belongs in your
   chat with the human, not in the file.
4. One file per logical change. Don't batch unrelated work.

### Soft guidance

- If the human's intent is ambiguous, ask in chat before writing.
- Read \`session.json\` to avoid redoing work or repeating mistakes.
- Brief is better — the human iterates fast.

---

## A worked example: spreadsheet → seated chart

The development officer drops their guest list into Centerpeace via the
CSV import button. They open Cowork (this folder is mounted) and say:

> "Populate the tables. Big donors near Table 1, families together,
>  spouses together, no table fuller than 8. See \`org-context.md\` for
>  our donor tier philosophy."

You read \`current-state.json\`, \`guests.csv\`, and \`org-context.md\`,
then write \`proposed-changes/initial-seating.json\`:

\`\`\`json
{
  "specVersion": "1.0",
  "agent": "claude-cowork",
  "note": "Seated 87 guests by donor tier; spouse pairs adjacent.",
  "assignments": { "t_1:0": "g_001", "t_1:1": "g_002", ... }
}
\`\`\`

Centerpeace applies it, the human sees the result on the canvas, drags two
people they want closer, and prints the chart. Done.
`;

/** Default contents of org-context.md. The team owns this file thereafter. */
export const ORG_CONTEXT = `# Organization Context

This file is yours. Centerpeace will never overwrite it.

Use it to capture the strategic intelligence that doesn't fit in your CRM
columns: donor tier philosophy, table strategy, recurring relationship
flags, leadership preferences, internal vocabulary.

A well-maintained \`org-context.md\` is the single biggest lever you have
for making AI seating suggestions feel right.

## Donor tier definitions

(How you label donors and what each label means strategically.)

## Table strategy philosophy

(How you compose tables. Who goes near the principal. How you mix donor
stages. How first-timers are integrated.)

## Recurring relationship flags

(People or pairs that carry context across every event — feuds, close
friendships, sensitivities your CRM doesn't capture.)

## Leadership preferences

(Standing preferences from the ED, board chair, or other principals.)

## Vocabulary

(Internal terminology — "table host", "ask table", org-specific acronyms.)
`;

/** Workspace .gitignore so guest data never leaks if someone runs git init. */
export const GITIGNORE = `# Centerpeace workspace — guest data should NEVER be committed.
current-state.json
guests.csv
tables.md
constraints.md
session.json
proposed-changes/
archive/

# org-context.md is intentionally NOT ignored — it's safe to commit if your
# team wants to track strategy across events. Comment the next line to
# also exclude it.
# org-context.md
`;

/** JSON Schema for `proposed-changes/*.json`. The single contract. */
export const APPLY_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://centerpeace.app/schemas/apply.schema.json",
  title: "CenterpeaceApplyChange",
  type: "object",
  required: ["specVersion"],
  additionalProperties: false,
  properties: {
    specVersion: { const: "1.0" },
    agent: { type: "string" },
    note: { type: "string" },
    assignments: {
      type: "object",
      description: "Map of '<tableId>:<seatIndex>' to guestId.",
      patternProperties: {
        "^[^:]+:[0-9]+$": { type: "string" },
      },
      additionalProperties: false,
    },
    removeAssignments: {
      type: "array",
      items: { type: "string", pattern: "^[^:]+:[0-9]+$" },
    },
    addConstraints: {
      type: "array",
      items: {
        type: "object",
        required: ["kind", "guestAId", "guestBId"],
        additionalProperties: false,
        properties: {
          kind: { enum: ["must-sit-with", "must-not-sit-with"] },
          guestAId: { type: "string" },
          guestBId: { type: "string" },
          note: { type: "string" },
        },
      },
    },
    removeConstraints: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

/** A worked example apply file so the agent has a concrete pattern. */
export const EXAMPLE_APPLY = `{
  "specVersion": "1.0",
  "agent": "claude-cowork",
  "note": "Seated 4 unplaced guests; kept the Smiths and Joneses on opposite sides.",
  "assignments": {
    "t_3:0": "g_001",
    "t_3:1": "g_002",
    "t_5:2": "g_010",
    "t_5:3": "g_011"
  },
  "addConstraints": [
    {
      "kind": "must-not-sit-with",
      "guestAId": "g_smith",
      "guestBId": "g_jones",
      "note": "Per org-context: longstanding board feud."
    }
  ]
}
`;
