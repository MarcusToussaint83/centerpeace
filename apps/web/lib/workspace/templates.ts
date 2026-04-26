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

/** Agent-facing system prompt that lives at the root of the workspace. */
export const README = `# Centerpeace Agent Workspace

You are an AI agent helping a nonprofit team build a seating chart for a
fundraising event. The team uses Centerpeace, an open-source seating tool,
and has shared this folder with you.

## How this works

Centerpeace continuously writes the live state of the event into this
folder. You read those files. When the human asks you to do something —
for example "populate the tables based on this CSV and these rules" — you
write a single JSON file into \`proposed-changes/\` describing the
assignments and constraints to apply. Centerpeace watches that folder,
snapshots a version (so the human can undo), applies your change, and
archives the file.

You do not need permission. You do not write request/response pairs. The
human is talking to you in your own app (Claude Cowork, Claude Code, etc).
This folder is the *artifact*, not a chat protocol.

## Files Centerpeace writes (read-only for you)

| Path | Contents |
|---|---|
| \`current-state.json\` | Authoritative live state. Always fresh. |
| \`guests.csv\` | Human-readable guest list. |
| \`tables.md\` | Current seating, rendered for humans. |
| \`constraints.md\` | Hard relationship rules. |
| \`org-context.md\` | **Read this first.** Org's persistent strategy. |
| \`session.json\` | Last 10 changes you applied. Use for continuity. |
| \`schemas/apply.schema.json\` | The schema your output must match. |
| \`schemas/examples/\` | Worked examples. |

## Files you write

Drop a JSON file into \`proposed-changes/\`. Filename can be anything ending
in \`.json\` — Centerpeace processes them in mtime order. After Centerpeace
applies your change, the file moves to \`archive/<year>/<month>/\`.

## The apply schema (the only schema you need)

\`\`\`json
{
  "specVersion": "1.0",
  "agent": "claude-cowork",
  "note": "One-sentence summary the human will see in the toast.",
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

All four operation arrays are optional. \`assignments\` overwrites whatever
was at that seat. Use \`removeAssignments\` to clear seats. Match the schema
at \`schemas/apply.schema.json\` exactly — Centerpeace rejects malformed
files (they go to archive/ with a \`.invalid\` suffix).

## Hard rules

1. Read \`org-context.md\` and \`current-state.json\` before acting.
2. Respect existing \`must-not-sit-with\` constraints. Violations will be
   flagged red on the canvas and the human will likely undo.
3. The \`note\` field should fit in one sentence. Longer reasoning belongs
   in your chat with the human, not in the file.
4. One file per logical change. Don't batch unrelated work.

## Soft guidance

- If the human's intent is ambiguous, ask them in chat before writing.
- Use \`session.json\` to avoid redoing work or repeating mistakes.
- Brief is better. The human is iterating; they want to see results fast.
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
