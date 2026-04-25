# Centerpeace — Agent Workspace Specification

This document specifies the file format contract between Centerpeace and
external LLM agents (Claude Cowork, Claude Code, Cursor, ChatGPT desktop,
or any other agent that can read and write files in a directory).

This is a public API. Changes to file formats are versioned and
backwards-compatible within a major version.

**Spec version: 1.0**

## Workspace layout

For each event in agent mode, Centerpeace maintains a workspace directory
at the path configured in the event settings (default
`~/seating-charts/<org-slug>/<event-slug>/`).

```
<workspace>/
├── README.md                   # Instructions for the agent (READ FIRST)
├── current-state.json          # Live event state (app-managed, read-only)
├── guests.csv                  # Human-readable guest list
├── tables.md                   # Current seating, human-readable
├── constraints.md              # Hard and soft constraints, human-readable
├── schemas/
│   ├── request.schema.json     # JSON Schema for request files
│   ├── response.schema.json    # JSON Schema for response files
│   └── examples/               # Example requests and responses
├── requests/                   # App writes here, agent reads
│   └── <type>-<timestamp>.md
├── responses/                  # Agent writes here, app reads
│   └── <type>-<timestamp>-response.json
├── proposed-changes/           # Optional staging by the agent
│   └── proposal-<timestamp>.json
└── archive/                    # Old requests and responses
    └── <year>/<month>/
```

## File ownership and trust boundary

- **App-managed files** (`current-state.json`, `guests.csv`, `tables.md`,
  `constraints.md`, all of `schemas/`, all of `requests/`): the app
  rewrites these on every state change. Agent must not edit them.
- **Agent-managed files** (everything in `responses/` and
  `proposed-changes/`): the agent writes these. The app only reads them.
- **Shared by convention**: `README.md` is shipped by the app but humans
  may edit it to refine the agent's behavior. Edits persist; the app
  does not overwrite README on state changes.

The agent never directly mutates app state. It writes proposals to
`responses/`. The app reads, validates against the response schema, and
surfaces the proposal in the UI for the user to accept, partially accept,
or reject.

## README.md (the system prompt)

The shipped `README.md` is the agent's instruction manual. It contains:

1. Project context — what Centerpeace is, what a seating chart is for,
   what success looks like.
2. File reference — what each file in the workspace contains and how to
   read it.
3. Hard rules — things the agent must never do.
4. Soft guidance — how to think about strategic seating.
5. Response format — the exact shape of valid responses.
6. Examples — a complete request/response pair for each request type.

A condensed version of the shipped README is in `apps/web/lib/workspace/
templates/README.md` in the codebase.

## current-state.json

Full event state, rewritten on every change. Schema:

```json
{
  "specVersion": "1.0",
  "generatedAt": "2026-04-25T14:30:00Z",
  "event": {
    "id": "evt_abc123",
    "name": "Annual Gala 2026",
    "date": "2026-09-15",
    "venue": "The Adolphus Hotel"
  },
  "guests": [
    {
      "id": "gst_001",
      "firstName": "Marcus",
      "lastName": "Davis",
      "partySize": 2,
      "accessibility": false,
      "attributes": {
        "donorStage": "major",
        "assignedOfficer": "Sarah Chen",
        "givingCapacity": "100k+"
      },
      "currentSeat": {
        "tableId": "tbl_007",
        "tableLabel": "Table 7",
        "seatIndex": 3,
        "locked": false
      }
    }
  ],
  "unseatedGuests": ["gst_042", "gst_043"],
  "tables": [
    {
      "id": "tbl_007",
      "label": "Table 7",
      "shape": "circle",
      "seatCount": 8,
      "hostGuestId": "gst_005",
      "strategicPurpose": "Major donor cultivation — focus on legacy giving",
      "accessibility": false,
      "seats": [
        { "index": 0, "guestId": "gst_005", "locked": true },
        { "index": 1, "guestId": "gst_006", "locked": false },
        { "index": 2, "guestId": null, "locked": false }
      ]
    }
  ],
  "relationships": [
    {
      "guestAId": "gst_001",
      "guestBId": "gst_002",
      "type": "must_sit_with",
      "reason": "spouses"
    },
    {
      "guestAId": "gst_010",
      "guestBId": "gst_011",
      "type": "must_not_sit_with",
      "reason": "former business partners — disputed exit"
    }
  ]
}
```

## Request files

Requests are markdown files in `requests/` with a YAML frontmatter block.
The frontmatter is structured; the markdown body is human-readable
context that may include user-provided prompting.

Filename pattern: `<type>-<ISO-timestamp>.md`

Example: `requests/suggest-arrangement-2026-04-25T14-30-00.md`

```markdown
---
specVersion: "1.0"
requestId: "req_xyz789"
type: "suggest-arrangement"
createdAt: "2026-04-25T14:30:00Z"
scope:
  unseatedOnly: true
  excludeLockedSeats: true
  preferredTables: []
---

# Request: Suggest arrangement

The user has 73 unseated guests and 18 tables with open seats. Please
propose a complete arrangement that:

- Respects all hard constraints (must_sit_with, must_not_sit_with)
- Does not move any guest in a locked seat
- Considers strategic purposes set per table
- Pairs major donors with their assigned officers when feasible

User context (optional, from the user when generating this request):

> Focus especially on Table 12 — that's our legacy giving conversation.
> The Hendersons should be there.

Write your response to:
`responses/suggest-arrangement-2026-04-25T14-30-00-response.json`

Match the schema at `schemas/response.schema.json`, request type
`suggest-arrangement`.
```

### Request types in v1

- `suggest-arrangement` — propose seat assignments for unseated guests,
  optionally re-arrange existing assignments.
- `review-table` — analyze one specific table's seating and suggest
  improvements with reasoning.
- `explain-arrangement` — produce a natural-language explanation of why
  the current seating works (or doesn't) for a given table.
- `find-conflicts` — identify constraint violations and suggest fixes.

## Response files

Responses are JSON, schema-validated. Filename matches the request:

`responses/<request-type>-<timestamp>-response.json`

Example for `suggest-arrangement`:

```json
{
  "specVersion": "1.0",
  "requestId": "req_xyz789",
  "type": "suggest-arrangement",
  "generatedAt": "2026-04-25T14:32:14Z",
  "agent": "claude-cowork",
  "summary": "Proposed seating for 73 unseated guests across 18 tables, prioritizing donor-officer pairings and the legacy giving table at Table 12.",
  "proposedAssignments": [
    {
      "guestId": "gst_042",
      "tableId": "tbl_012",
      "seatIndex": 2,
      "displaces": null,
      "reasoning": "Hendersons placed at Table 12 per user request; legacy giving fits their stage."
    },
    {
      "guestId": "gst_043",
      "tableId": "tbl_012",
      "seatIndex": 3,
      "displaces": null,
      "reasoning": "Spouse of gst_042, must_sit_with constraint."
    }
  ],
  "warnings": [
    {
      "level": "info",
      "message": "Could not place gst_088 — no compatible table given the must_not_sit_with constraints with gst_044, gst_055, gst_066."
    }
  ],
  "unfulfilledRequests": []
}
```

### Response schema rules

- `specVersion` must match the request.
- `requestId` must match the request's id.
- `proposedAssignments` array may be empty.
- Each assignment must reference a real guest, table, and valid seat
  index. The app validates this on read.
- `displaces` is the guestId currently in that seat (if any), making
  swaps explicit. The app verifies this matches current state.
- `reasoning` is required per assignment. The app surfaces it in the UI.
- `warnings` are surfaced but do not block the proposal.
- `unfulfilledRequests` lists request items the agent could not address.

### Validation behavior

When the app detects a new file in `responses/`:

1. Parse JSON. On parse error: surface error to user, file moves to
   `archive/<date>/<filename>.invalid.json`.
2. Validate against schema. On validation error: surface specific error
   ("missing field `proposedAssignments`"), file marked invalid.
3. Validate references (guests exist, tables exist, seat indexes valid,
   `displaces` matches current state). On reference error: surface
   actionable error to user.
4. Validate hard constraints (no must_not_sit_with violations, no moves
   on locked seats). Violating proposals are still surfaced but flagged
   in red — the user can choose to accept anyway, or reject.
5. On success: present proposal in canvas as preview overlay.

## Schemas folder

The `schemas/` directory ships JSON Schema definitions for request and
response files, plus example pairs. The agent should reference these
rather than inferring formats from prose.

`schemas/examples/` contains a complete worked example for each request
type — a request markdown and its corresponding response JSON — so the
agent has concrete patterns to follow.

## Versioning and compatibility

The `specVersion` field is in every file. Version 1.x changes are
backwards-compatible: new optional fields may be added, but existing
field names and types do not change.

A 2.0 version (if ever needed) would be a breaking change and would ship
new schema files. The app would support reading both during a deprecation
window.

## Privacy considerations

The workspace folder contains all guest names and attributes for the
event, in plain text on the user's filesystem. Implications:

- Workspace path defaults to user's home directory (per-user, not shared).
- The app warns on first agent-mode setup that guest data will be written
  to disk in plain text.
- A `.gitignore` is shipped at the workspace root listing all sensitive
  files, so users who put their workspace in a git repo do not
  accidentally commit guest data.
- Users can clear the workspace from the app UI, which deletes all files
  except `archive/`.

## Cross-platform notes

- File watching uses chokidar with native FS events on macOS and Linux,
  polling fallback on Windows for reliability.
- Path separators normalized to forward slashes in all schema content
  regardless of OS.
- Line endings: LF in shipped files; the app reads both LF and CRLF
  responses.
- Unicode: all files UTF-8. Names with non-ASCII characters supported.
