# Centerpeace — Roadmap & Iteration Notes

This file tracks **what's intentionally deferred** so we can move fast on
the canvas-first prototype without losing track of necessary work. The
authoritative milestone plan lives in [BUILD_PLAN.md](./BUILD_PLAN.md);
this file is the practical "we punted on this and here's why" log.

## Current state — v0 canvas prototype

Live demo: `/event/demo`

- 6 round tables × 8 seats (48 capacity), 40 hand-coded guests
- Pan / zoom (wheel + drag empty space)
- Drag tables to rearrange
- Click a guest to pick them up, click a seat to place
- Click a seated guest to pick them back up; click again to unseat
- localStorage persistence (`centerpeace.event.demo`)
- Reset button restores the seed

## Deferred — bring back when product needs it

| Topic | Bring back at | Notes |
|---|---|---|
| **Postgres + Drizzle** | When >1 user or server features needed | Today: localStorage. Schema lives in `DATA_MODEL.md`; only commit Drizzle once data shape stabilizes. |
| **Auth.js v5** | Right before sharing with a teammate | Currently single-user. Add credentials provider only; defer OAuth/magic links. |
| **Multi-org / multi-event** | M1 (after canvas feels right) | The store is hardcoded to one event id `demo`. Generalize once we know what events need. |
| **Org switcher / roles** | M1 | Owner/Editor/Viewer per ARCHITECTURE.md. |
| **CSV import + column mapping** | M2 | Hand-coded seed (`apps/web/lib/seed.ts`) is faster to iterate against. |
| **Constraint editor (must / must-not / prefer-near)** | After live constraint visualization is sketched | Need to feel the UX of constraints _on_ the canvas before designing the editor. |
| **Constraint solver** | M6 | `packages/constraints` is a placeholder. The shape of inputs/outputs depends on what live constraints we end up modeling. |
| **AI: API mode (Anthropic/OpenAI/Google/Ollama)** | M6 | Provider interface designed in AI_INTEGRATION.md. |
| **AI: agent mode (workspace folder)** | M6 | Spec in AGENT_WORKSPACE_SPEC.md. |
| **Comments + version history** | M5 | Solo iteration doesn't need it. |
| **PDF exports (wall chart, place cards, etc.)** | M7 | Pre-launch concern. |
| **Docker Compose / Dockerfile** | M8 | Iteration speed > containerization. Add right before public launch. |
| **Real drag from panel onto canvas** | When click-to-place clearly limits us | Click-to-place is faster to build and may be enough; @dnd-kit is installed-ready when we want it. |
| **Undo / redo command stack** | After core seating actions are stable | Don't write the command stack until we know all the action types. |
| **Keyboard navigation + a11y audit** | M8 | Make it work with mouse first, then make it accessible. Don't ship without this. |
| **Comments / mentions / notifications** | M5 | |
| **Print-ready canvas mode** | M7 | |
| **Mobile / tablet canvas** | Post-v1 | Desktop-first per ARCHITECTURE.md. |

## Things to validate with the canvas prototype

Before adding plumbing, the prototype should answer:

1. Does click-to-place feel fast enough, or do we need real drag?
2. Are 8-seat round tables the right default? Mixed shapes from day one?
3. Is initials-on-seat readable, or do we need full names on hover?
4. What does constraint visualization (red dotted lines, X overlays) look
   like in practice? Subtle, or in-your-face?
5. How does the workflow feel for someone who places 200 guests?
6. Does the side panel scale to 200+ guests, or do we need virtualization
   sooner than M3 implied?

## Iteration mantras

- **Ship to validate, not to be done.** Each commit should make the
  product feel more like the thing.
- **Don't add infrastructure before the feature it serves.** No DB before
  multi-user. No auth before sharing. No Docker before launch.
- **Delete code aggressively.** Anything we replace, we delete the same
  commit. No graveyard of "old way" files.
- **Notes here, not in chat.** When we punt on something, log it in this
  file the same session, with the trigger that brings it back.
