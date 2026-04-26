# Centerpeace — Data Model

This document is the canonical reference for Centerpeace's data structures.
It covers the database schema, the canvas state JSON shape, and the
relationships between entities. The Drizzle schema in `packages/db` and
the TypeScript types in `packages/types` derive from this document.

## Entity overview

```
Organization
  └─ Member (User × Organization with role)
  └─ Event
       ├─ Guest
       │    └─ GuestRelationship (Guest × Guest)
       ├─ Table
       │    └─ Seat
       ├─ ArrangementVersion
       ├─ Comment
       └─ AuditLogEntry
```

## Tables

### users

Represents an authenticated person.

| Column          | Type        | Notes                              |
|-----------------|-------------|------------------------------------|
| id              | uuid (pk)   |                                    |
| email           | text        | unique, lowercased on write        |
| password_hash   | text        | bcrypt                             |
| display_name    | text        |                                    |
| created_at      | timestamptz | default now()                      |
| updated_at      | timestamptz |                                    |

### organizations

A tenant boundary. Every event belongs to exactly one org.

| Column      | Type        | Notes                                    |
|-------------|-------------|------------------------------------------|
| id          | uuid (pk)   |                                          |
| slug        | text        | unique, URL-safe                         |
| name        | text        |                                          |
| created_at  | timestamptz |                                          |
| settings    | jsonb       | { ai_mode, theme, default_workspace_path }|

### org_members

Many-to-many between users and organizations with a role.

| Column          | Type        | Notes                              |
|-----------------|-------------|------------------------------------|
| id              | uuid (pk)   |                                    |
| user_id         | uuid (fk)   | -> users.id                        |
| organization_id | uuid (fk)   | -> organizations.id                |
| role            | enum        | owner, editor, viewer              |
| invited_by      | uuid (fk)   | -> users.id, nullable              |
| joined_at       | timestamptz |                                    |

Unique on (user_id, organization_id).

### events

A fundraising dinner or similar gathering.

| Column            | Type        | Notes                              |
|-------------------|-------------|------------------------------------|
| id                | uuid (pk)   |                                    |
| organization_id   | uuid (fk)   |                                    |
| name              | text        | "Annual Gala 2026"                 |
| date              | date        | nullable                           |
| venue_name        | text        | nullable                           |
| expected_guests   | integer     | nullable                           |
| status            | enum        | draft, active, archived            |
| ai_mode_override  | enum        | solver, api, agent, null (use org) |
| workspace_path    | text        | filesystem path for agent mode     |
| created_by        | uuid (fk)   |                                    |
| created_at        | timestamptz |                                    |
| updated_at        | timestamptz |                                    |

### guests

A person attending an event.

| Column           | Type        | Notes                              |
|------------------|-------------|------------------------------------|
| id               | uuid (pk)   |                                    |
| event_id         | uuid (fk)   |                                    |
| first_name       | text        | required                           |
| last_name        | text        | required                           |
| email            | text        | nullable                           |
| party_size       | integer     | default 1                          |
| dietary          | text        | nullable, free-form                |
| accessibility    | boolean     | needs accessible seating           |
| attributes       | jsonb       | custom fields from CSV             |
| notes            | text        | nullable, freetext relational context |
| created_at       | timestamptz |                                    |

The `attributes` jsonb column holds anything the CSV import didn't map to
a known field — donor stage, assigned officer, giving capacity, etc. The
shape is per-event (different orgs care about different attributes) and
the UI exposes whatever keys are present.

The `notes` field is intentionally unstructured. It is the place for
relational and strategic context that does not fit a schema: history
between guests, sensitivities, conversation goals for the evening, or
anything a development officer knows that a CRM does not capture. This
field is the primary input for AI soft reasoning — the agent reads it
when deciding placement, and development staff should be encouraged to
fill it in before running any AI suggestion. Notes are visible only to
org members (never exported to guest-facing materials).

### guest_relationships

Constraints between guest pairs.

| Column           | Type        | Notes                              |
|------------------|-------------|------------------------------------|
| id               | uuid (pk)   |                                    |
| event_id         | uuid (fk)   |                                    |
| guest_a_id       | uuid (fk)   |                                    |
| guest_b_id       | uuid (fk)   |                                    |
| relationship     | enum        | must_sit_with, must_not_sit_with,  |
|                  |             | prefer_near                        |
| reason           | text        | nullable, "spouses", "feud"        |
| created_by       | uuid (fk)   |                                    |
| created_at       | timestamptz |                                    |

Stored canonically with guest_a_id < guest_b_id to dedupe. Enforced via
check constraint.

### tables

A physical table at the event.

| Column              | Type        | Notes                              |
|---------------------|-------------|------------------------------------|
| id                  | uuid (pk)   |                                    |
| event_id            | uuid (fk)   |                                    |
| label               | text        | "Table 7", "Founder's Table"       |
| shape               | enum        | circle, rectangle                  |
| position_x          | float       | logical units (0-10000)            |
| position_y          | float       | logical units (0-10000)            |
| rotation            | float       | degrees                            |
| seat_count          | integer     | 2-20 typical                       |
| radius              | float       | for circle                         |
| width               | float       | for rectangle                      |
| height              | float       | for rectangle                      |
| host_guest_id       | uuid (fk)   | nullable -> guests.id              |
| strategic_purpose   | text        | nullable, "major donor cultivation"|
| accessibility       | boolean     | accessible to entry/restrooms      |
| created_at          | timestamptz |                                    |
| updated_at          | timestamptz |                                    |

### seats

A position at a table where a guest can be assigned.

| Column           | Type        | Notes                              |
|------------------|-------------|------------------------------------|
| id               | uuid (pk)   |                                    |
| table_id         | uuid (fk)   |                                    |
| seat_index       | integer     | 0-based, position around table     |
| guest_id         | uuid (fk)   | nullable                           |
| locked           | boolean     | AI suggestions cannot move this    |
| updated_at       | timestamptz |                                    |

Unique on (table_id, seat_index). Guest_id unique (a guest can occupy at
most one seat per event) — enforced via partial unique index where
guest_id is not null.

Seats are created automatically when a table is created (one row per
seat_index from 0 to seat_count - 1). Adjusting seat_count adds or
removes seat rows; removing a seat with an assigned guest moves that
guest back to the unseated pool.

### arrangement_versions

Named snapshots of the full seating state.

| Column           | Type        | Notes                              |
|------------------|-------------|------------------------------------|
| id               | uuid (pk)   |                                    |
| event_id         | uuid (fk)   |                                    |
| label            | text        | "v2 — pre-exec review"             |
| snapshot         | jsonb       | full EventLayout JSON              |
| author_id        | uuid (fk)   |                                    |
| created_at       | timestamptz |                                    |

The snapshot is a denormalized capture of the canvas state at save time:
all tables, seats, and seat assignments. Restoring overwrites current
state with the snapshot.

### comments

Threaded comments on guests, tables, or arrangements.

| Column           | Type        | Notes                              |
|------------------|-------------|------------------------------------|
| id               | uuid (pk)   |                                    |
| event_id         | uuid (fk)   |                                    |
| target_type      | enum        | guest, table, arrangement          |
| target_id        | uuid        | id of the target entity            |
| parent_id        | uuid (fk)   | nullable, for threaded replies     |
| author_id        | uuid (fk)   |                                    |
| body             | text        | markdown supported                 |
| resolved         | boolean     | default false                      |
| created_at       | timestamptz |                                    |

Mentions parsed at render time from `@username` patterns; not stored
separately.

### audit_log_entries

Every state-changing action, captured for the timeline view.

| Column           | Type        | Notes                              |
|------------------|-------------|------------------------------------|
| id               | uuid (pk)   |                                    |
| event_id         | uuid (fk)   |                                    |
| actor_id         | uuid (fk)   |                                    |
| action           | text        | "guest.assigned", "table.created"  |
| target_type      | text        |                                    |
| target_id        | uuid        |                                    |
| metadata         | jsonb       | action-specific details            |
| created_at       | timestamptz |                                    |

### import_templates

Saved CSV column mappings for repeat use.

| Column           | Type        | Notes                              |
|------------------|-------------|------------------------------------|
| id               | uuid (pk)   |                                    |
| organization_id  | uuid (fk)   |                                    |
| name             | text        | "Salesforce export — Annual Gala"  |
| mapping          | jsonb       | source col → target field          |
| created_by       | uuid (fk)   |                                    |
| created_at       | timestamptz |                                    |

## Canvas state JSON shape

The shape passed between server and client for canvas rendering, and the
shape stored in `arrangement_versions.snapshot`:

```typescript
type EventLayout = {
  eventId: string;
  canvasSize: { width: number; height: number };  // logical units
  tables: TableState[];
  unseatedGuests: GuestSummary[];
};

type TableState = {
  id: string;
  label: string;
  shape: 'circle' | 'rectangle';
  position: { x: number; y: number };
  rotation: number;
  seatCount: number;
  radius?: number;
  width?: number;
  height?: number;
  hostGuestId: string | null;
  strategicPurpose: string | null;
  accessibility: boolean;
  seats: SeatState[];
};

type SeatState = {
  id: string;
  index: number;
  guest: GuestSummary | null;
  locked: boolean;
};

type GuestSummary = {
  id: string;
  firstName: string;
  lastName: string;
  partySize: number;
  accessibility: boolean;
  attributes: Record<string, unknown>;
  notes: string | null;  // relational/strategic context for AI and staff
};
```

## Indexes

Critical indexes for performance:

- `events(organization_id, status)`
- `guests(event_id, last_name, first_name)`
- `guest_relationships(event_id, guest_a_id)` and `(event_id, guest_b_id)`
- `tables(event_id)`
- `seats(table_id, seat_index)` — already unique
- `seats(guest_id) WHERE guest_id IS NOT NULL` — partial unique
- `comments(event_id, target_type, target_id)`
- `audit_log_entries(event_id, created_at DESC)`

## Cascading deletes

- Delete an organization → cascade to events, members
- Delete an event → cascade to guests, tables, seats, comments, versions
- Delete a guest → set guest_id to null on seats, cascade-delete relationships
- Delete a table → cascade to seats, displaced guests return to unseated

## Migrations strategy

Drizzle Kit generates migrations from schema changes. Migrations are
checked into the repo and run automatically on container startup. No
runtime schema changes; all changes go through reviewed migration files.
