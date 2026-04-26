# Centerpeace — Build Plan

This document expands the eight milestones from project kickoff to v1
launch. Each milestone has a goal, deliverables, demo state, definition
of done, and rough size estimate.

Pace assumption: vibe-coding with Claude Code, focused work sessions
(not hours, not stories — just "sessions" as the unit, since they vary).

## Milestone 0: Foundation

**Goal**: a clonable repo with auth working and the dev experience polished.

**Deliverables**

- pnpm workspace at root: `apps/web`, `packages/db`, `packages/types`,
  `packages/constraints`
- Next.js 15 app with App Router, Tailwind, shadcn/ui initialized
- Drizzle setup with Postgres connection, migration runner
- Docker Compose (postgres + app), healthchecks, seed script entry point
- `.env.example` with every variable documented inline
- README.md, CONTRIBUTING.md, LICENSE (MIT), CODE_OF_CONDUCT.md
- GitHub repo with Actions CI (lint, typecheck, build on PR)
- Auth.js v5 credentials provider, sign-in/sign-up pages with shadcn forms
- CSS variable theming foundation, light/dark toggle

**Demo state**: clone, `cp .env.example .env`, `docker compose up`, browse
to localhost:3000, sign up, land on empty dashboard.

**Definition of done**

- README "15-minute setup" timer-tested by a fresh contributor (or you
  on a fresh machine)
- CI green on the main branch
- Sign-up creates user + personal organization
- Sign-in/sign-out works end-to-end

**Size**: ~1 week

---

## Milestone 1: Orgs, events, members

**Goal**: multi-tenancy works; events can be created and listed.

**Deliverables**

- DB schema: organizations, org_members, events
- Migration files generated and committed
- Org switcher in top nav, current org persisted in session
- Create-org flow
- Invite-member flow: generate single-use invite links (no SMTP)
- Events list page: create, rename, archive
- Event detail shell with empty states for guests and tables
- Role-based middleware (owner/editor/viewer)

**Demo state**: create "Seed Company" org, invite teammate via copied link,
teammate joins, both create "Annual Gala 2026" event.

**Definition of done**

- A user can belong to 2+ orgs and switch between them
- A viewer cannot edit; tested manually
- Archive an event and it disappears from default list, returns via filter

**Size**: ~3-5 sessions

---

## Milestone 2: Guest list + CSV import

**Goal**: real data lands in events.

**Deliverables**

- DB schema: guests, guest_relationships, import_templates
- Guest list page: search, filter, sort
- Manual guest add/edit form
- CSV import flow:
  - File upload + first 5 rows preview
  - Column mapping UI: source columns → target fields
  - Duplicate detection on (email + last_name) match
  - Plus-one expansion: party_size > 1 creates linked guests
  - Save mapping as named import template
- Bulk operations: select N guests → set attribute / delete / add
  relationship
- Relationship editor: pair-picker for must / must-not / prefer-near
- Sample CSV in `examples/sample-event-200-guests.csv`

**Demo state**: import 200 guests in 90 seconds, set "Marcus and Sarah
Chen must sit together" via relationship editor.

**Definition of done**

- Sample CSV imports without errors
- Re-importing the same CSV detects duplicates
- A saved import template applies on a future import without remapping
- Relationships are bidirectional (both guests show the constraint)

**Size**: ~1 week

---

## Milestone 3: Canvas v1 — layout mode

**Goal**: room layout feels premium.

**Deliverables**

- DB schema: tables, seats
- react-konva canvas with viewBox state
- Pan: space-drag, trackpad two-finger drag
- Zoom: wheel, trackpad pinch, zoom-toward-cursor math
- Add table toolbar: circle, rectangle, seat-count picker
- Drag tables with momentum, snap to 100-unit grid (toggle with shift)
- Selection: single, shift-multi, marquee
- Rotation handle for rectangles
- Properties panel (Framer Motion slide-in): label, shape, seat count,
  host, strategic purpose, accessibility flag
- Delete, duplicate (Cmd-D)
- Undo/redo (Cmd-Z, Cmd-Shift-Z) command stack
- Auto-save debounced 500ms
- Hover state: subtle scale + shadow

**Demo state**: lay out a 25-table room in 5 minutes. Drags are smooth.
Every interaction has small animation.

**Definition of done**

- 60fps drag with 25 tables on a 2020-era laptop
- Auto-save persists across page refresh
- Undo correctly reverses every action type

**Size**: ~1.5 weeks

---

## Milestone 4: Canvas v2 — seating mode

**Goal**: assigning guests to seats is the core delightful workflow.

**Deliverables**

- Mode toggle: Layout / Seating / Review
- In Seating: tables locked in position, seats become drop targets
- Left panel: unseated guest list with search, filter by attribute
- Drag from panel onto seat:
  - Ghost preview, target highlight, invalid dimming
  - Konva tween on drop
  - Swap behavior with displaced-guest toast (undoable)
- Click-to-move: click guest, click seat
- Drag seated guest to another seat
- Right-click context menu on seat: lock, clear, view guest
- Constraint visualization in real time:
  - Violated must-sit-with: red dotted line between seats
  - Violated must-not-sit-with: red X overlay
- Capacity badges on tables: "6/8"
- Keyboard navigation: Tab through panel, arrow keys around table

**Demo state**: assign 200 guests to 25 tables in one session. Constraint
violations are obvious as they happen.

**Definition of done**

- Drag from panel to seat works in <300ms perceived latency
- Constraint visualization appears within 1 frame of placement
- Keyboard-only assignment is possible end-to-end
- Screen reader announces seat assignments correctly

**Size**: ~1.5 weeks

---

## Milestone 5: Comments + version history

**Goal**: collaboration without real-time complexity.

**Deliverables**

- DB schema: comments, arrangement_versions, audit_log_entries
- Comment pin overlay on canvas in Review mode
- Comment thread side panel: shadcn-styled, threaded replies, @mentions
- Notification bell in nav: unread mention count, list view
- Version history panel:
  - "Save version" with label
  - List of versions
  - Click to preview (canvas shows snapshot, banner)
  - Restore with confirm
- Audit log timeline view per event

**Demo state**: development officer comments on three tables, event lead
saves "v2 — after dev review", exec restores an earlier version.

**Definition of done**

- Comments persist across sessions
- @mentions create notifications
- Restoring a version writes new audit entries (the restore itself is
  logged)
- Resolved comments hide by default

**Size**: ~3-5 sessions

---

## Milestone 6: AI integration — three modes

**Goal**: AI features work via solver, API, or agent — user's choice.

**Deliverables**

- `packages/constraints`: solver
  - Backtracking with constraint propagation
  - Pure functions, full unit test coverage
  - Returns valid arrangement or unsatisfiable-constraint explanation
  - <1s for 500 guests / 50 tables
- `apps/web/lib/ai/`: API mode
  - Provider interface
  - AnthropicProvider, OpenAIProvider, GoogleProvider, OllamaProvider
    via Vercel AI SDK
  - Selected via env vars per-org
  - Structured output for arrangements
- `apps/web/lib/workspace/`: agent mode
  - Workspace lifecycle: create, sync state, archive old files
  - State serialization: current-state.json, guests.csv, tables.md,
    constraints.md
  - session.json: written after each request/response cycle, last 10
    exchanges, enables conversational continuity across requests
  - org-context.md: empty template shipped on first workspace setup,
    never overwritten by app, owned by the org's team
  - Workspace README template (the agent system prompt)
  - JSON schemas in `schemas/` of every workspace
  - Example request/response pairs in `schemas/examples/`
  - chokidar file watcher on `responses/`
  - Schema validation pipeline supporting all response types including
    `propose-constraint`
  - Constraint write-back: accepted `propose-constraint` responses
    persist to DB and trigger `constraints.md` rewrite
  - Server-Sent Events to push proposals to client
- Settings UI:
  - Org level: default AI mode
  - Event level: override AI mode, configure workspace path
  - Workspace setup wizard for agent mode (includes prompt to fill in
    org-context.md)
- Suggestions panel in canvas:
  - "Suggest arrangement" button
  - Preview overlay with arrows showing proposed moves
  - Accept all / accept some / reject
  - "Explain this seating" button per table — outputs either a
    per-table explanation or a full-event stakeholder briefing document
    suitable for sharing with an ED or board chair before the event
- Graceful degradation: missing API key falls back to solver-only

**Demo state**: in API mode, click "Suggest arrangement", 73 unseated guests
land in seats with reasoning. In agent mode, click "Generate request",
flip to Cowork, "process the latest request", flip back, see proposal
appear in real time.

**Definition of done**

- All three modes produce a valid arrangement for a 200-guest test event
- Agent mode workspace files validate against shipped schemas
- Solver-only mode works with zero AI configuration
- Switching modes mid-event works without data loss

**Size**: ~1.5 weeks (the +0.5 over original Milestone 6 absorbs agent mode)

---

## Milestone 7: PDF export

**Goal**: night-of-event materials ready for the printer.

**Deliverables**

- `/api/export/wall-chart`: high-res Konva → PNG → react-pdf, 24"x36"
- `/api/export/guest-by-table`: alphabetical within each table
- `/api/export/master-list`: alphabetical with table number
- `/api/export/place-cards`: Avery 5302 layout, fold line marked
- `/api/export/table-cards`: large per-table identifier cards
- Export panel in event detail: pick exports → "Download all" zips them
- Print-friendly canvas: larger names, higher contrast, no UI chrome

**Demo state**: event lead clicks "Export all", gets a zip with five PDFs
ready for the printer.

**Definition of done**

- All five export types render correctly for the 200-guest sample event
- Wall chart PDF prints at 24"x36" with crisp text
- Place cards align to Avery 5302 in a print test

**Size**: ~1 week

---

## Milestone 8: Polish, docs, launch

**Goal**: ready for public release.

**Deliverables**

- Empty states for every screen with helpful CTAs
- Skeleton loading states (shadcn skeletons)
- Error boundaries with recovery actions
- First-run onboarding tour
- Accessibility audit pass: keyboard, ARIA, contrast, screen reader smoke test
- Docs in `/docs` folder, rendered by GitHub:
  - Getting started
  - Architecture overview
  - Deployment guide
  - AI integration guide (the three modes, with agent mode tutorials
    for Cowork and Claude Code)
  - Contributing guide
- Sample CSVs in `examples/`
- Seed data scripts: realistic event for first launch
- Self-host deployment guide
- README with screenshots and 60-second demo video
- Public launch: post in NTEN, TechSoup, faith-tech communities, HN
- Seed Company runs first internal event with the tool

**Demo state**: ready to share publicly. Seed Company uses it for real.

**Definition of done**

- Fresh contributor can deploy with docker compose in <15 minutes
- Accessibility audit shows no critical issues
- Demo video records the full happy path in under 90 seconds
- Internal Seed Company event runs successfully with the tool

**Size**: ~1 week

---

## Total

Roughly 8-10 weeks at focused pace. At 10 hours/week of vibe-coding, plan
3-4 months calendar time. At 20 hours/week, 8-10 calendar weeks.

## Faster path option

If timeline pressure: ship MVP at Milestone 7, defer Milestone 5 to v1.5.
Comments and version history are valuable but not blocking for initial
internal use. Cuts ~1 week.

## Dependencies between milestones

- M1 depends on M0 (auth)
- M2 depends on M1 (events)
- M3 depends on M1 (events)
- M4 depends on M2 + M3 (guests + tables)
- M5 depends on M4 (canvas to comment on)
- M6 depends on M4 (state to operate on)
- M7 depends on M3 + M4 (canvas to export)
- M8 depends on all prior

M3 and M2 can run in parallel after M1 if you want to context-switch.

## Risks and mitigations

**Canvas performance at scale**: target 50 tables / 500 guests. If
react-konva struggles, reach is to virtualization (only render visible
tables) before swapping libraries.

**Agent mode UX confusion**: users may not understand the file-based
flow. Mitigate with the setup wizard, clear visual indicators of
"waiting for response", and tutorial videos in M8.

**CSV import edge cases**: real CRM exports are messy. Plan for an
extra session in M2 if early testing reveals issues.

**Constraint solver unsatisfiable**: real events have impossible
constraints. The solver must return useful "here's what conflicts"
explanations, not just fail. Allocate solver-test time in M6.
