# Centerpeace — Architecture

## High-level shape

Centerpeace is a single Next.js application backed by Postgres, deployable
via Docker Compose. It uses a monorepo structure to share types and pure
logic between the app, the database layer, and the constraint solver.

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Canvas       │  │ Side panels  │  │ Modals/      │   │
│  │ (react-konva)│  │ (shadcn +    │  │ overlays     │   │
│  │              │  │  framer-     │  │              │   │
│  │              │  │  motion)     │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└────────────┬────────────────────────────────────────────┘
             │ HTTP (Next.js API routes)
┌────────────┴────────────────────────────────────────────┐
│  Next.js server                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ API routes   │  │ Auth.js      │  │ File watcher │   │
│  │ (REST)       │  │ (sessions)   │  │ (agent mode) │   │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘   │
│         │                                   │           │
│  ┌──────┴───────────────────────────────────┴───────┐   │
│  │ Service layer                                    │   │
│  │  - Event service                                 │   │
│  │  - Guest service                                 │   │
│  │  - Layout service                                │   │
│  │  - AI orchestration                              │   │
│  │  - Workspace service                             │   │
│  │  - Export service                                │   │
│  └──────┬───────────────────────┬───────────────────┘   │
│         │                       │                       │
│  ┌──────┴────────┐    ┌─────────┴────────┐              │
│  │ Drizzle ORM   │    │ Constraint       │              │
│  │               │    │ solver (pure fns)│              │
│  └──────┬────────┘    └──────────────────┘              │
└─────────┼───────────────────────────────────────────────┘
          │
   ┌──────┴──────┐
   │ Postgres 16 │
   └─────────────┘
```

## Tech stack

| Layer            | Choice                       | Why                                                   |
|------------------|------------------------------|-------------------------------------------------------|
| Framework        | Next.js 15 (App Router)      | Mature, single-process deploy, server components      |
| Language         | TypeScript (strict)          | Type safety end-to-end, shared types in monorepo      |
| Styling          | Tailwind + shadcn/ui         | Customizable primitives, accessible by default        |
| Canvas           | react-konva                  | Premium feel for 500+ objects, MIT license            |
| Animation        | Framer Motion                | Out-of-canvas transitions, panels, modals             |
| Drag-and-drop    | @dnd-kit/core                | Panel-to-canvas drops, accessible by default          |
| Database         | Postgres 16                  | JSON columns + relational integrity                   |
| ORM              | Drizzle                      | Lightweight, no client generation step, SQL-first     |
| Auth             | Auth.js v5                   | Self-hostable, no third-party dependency              |
| File storage     | Filesystem (default), S3 API | Works offline, S3 adapter for production              |
| AI integration   | Vercel AI SDK + workspace    | Model-agnostic, three integration modes               |
| PDF              | @react-pdf/renderer          | Declarative, server-side rendering                    |
| CSV              | papaparse                    | Battle-tested CSV handling                            |
| File watching    | chokidar                     | Cross-platform, agent mode workspace monitoring       |
| Container        | Docker Compose               | Single-command deploy for self-hosters                |
| License          | MIT                          | Maximum adoption                                      |

## Monorepo layout

```
centerpeace/
├── apps/
│   └── web/                    # Next.js application
│       ├── app/                # App Router pages
│       ├── components/
│       │   ├── canvas/         # react-konva components
│       │   ├── panels/         # shadcn-based side panels
│       │   └── ui/             # shadcn primitives
│       ├── lib/
│       │   ├── ai/             # provider abstraction (API mode)
│       │   ├── workspace/      # agent mode file management
│       │   ├── import/         # CSV parsing, column mapping
│       │   └── export/         # PDF generation
│       └── server/             # API route handlers, services
├── packages/
│   ├── db/                     # Drizzle schema, migrations
│   ├── types/                  # Shared TypeScript types
│   └── constraints/            # Constraint solver (pure functions)
├── docs/                       # Project documentation
├── examples/                   # Sample CSVs, seed data
├── docker-compose.yml
├── .env.example
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## The three AI modes

Every AI-assisted feature in Centerpeace works in one of three modes,
selected per-organization (with per-event override).

### Solver-only mode

No LLM involved. Deterministic constraint satisfaction handles hard rules
(must-sit-with, must-not-sit-with, locked seats, capacity, accessibility).
Returns a valid arrangement or a list of unsatisfiable constraints with
explanation.

This mode always works, has zero cost, and runs in milliseconds for the
500-guest target. It's the floor of the AI feature set.

### API mode

Same constraint solver, plus an LLM call for soft optimization (cultivation
strategy, conversation dynamics, table host goals) and natural-language
explanations.

The LLM call is abstracted behind a provider interface implemented for
Anthropic, OpenAI, Google, and Ollama via the Vercel AI SDK. Configuration
is per-organization via environment variables or admin UI:

```
AI_MODE=api
AI_PROVIDER=anthropic
AI_MODEL=claude-opus-4-7
ANTHROPIC_API_KEY=sk-ant-...
```

If keys are missing, the org silently falls back to solver-only mode.

### Agent mode

The app reads and writes a structured directory on disk. The user's
agentic LLM tool (Claude Cowork, Claude Code, Cursor, etc.) is pointed at
that directory and processes requests as part of the user's normal
workflow with their AI.

Workflow:

1. App writes `current-state.json`, `guests.csv`, `constraints.md`,
   `tables.md` to the workspace folder.
2. User clicks "Generate AI request" — app writes a request file
   (e.g., `requests/suggest-arrangement-2026-04-25-1430.md`).
3. User opens their agent, says "process the latest request in this folder."
4. Agent reads the workspace README (which is the system prompt), reads
   the request, reads current state, writes a response file to
   `responses/`.
5. App watches the responses folder. On new file, validates schema,
   surfaces the proposal in the canvas as a preview overlay.
6. User accepts, partially accepts, or rejects.

The agent never directly mutates app state. It proposes; the app validates
and applies. See AGENT_WORKSPACE_SPEC.md for file formats.

## Data flow patterns

**Reads** — server components fetch via Drizzle, hydrate client components
with initial state. Client components use SWR-pattern hooks for live
updates within a session.

**Writes** — client mutations hit Next.js API routes, which validate via
Zod, call service layer, persist via Drizzle, return updated state.

**Auto-save** — canvas changes are debounced (500ms) and persisted as the
"current arrangement" of an event. Named version snapshots are explicit
user actions.

**Agent workspace sync** — the workspace service runs on the server,
maintains `.seating-agent/` folders, and uses chokidar to watch the
responses subdirectory. New files trigger schema validation and a
real-time notification to the relevant client session via Server-Sent
Events.

## Multi-tenancy model

Multi-org from day one.

- Every user can belong to multiple organizations.
- Every entity (event, guest, table, layout, comment, version) is scoped
  to an organization.
- Database queries filter by org_id at the service layer; API routes
  enforce org membership and role.
- Org switcher in top nav; current org stored in session.

Roles per org:

- **Owner** — full control including org settings, member management
- **Editor** — create and modify events, guests, tables, layouts
- **Viewer** — read-only access plus comment ability

## Auth model

Auth.js v5 with credentials provider only in v1. Email + password.

- Passwords hashed with bcrypt (cost 12).
- Session via JWT cookie, 30-day expiry, sliding refresh.
- Sign-up creates the user plus a personal organization owned by them.
- Additional org membership via invite link (single-use token, 7-day TTL).

OAuth and magic links are deferred to v1.5 to keep the self-host setup
free of SMTP and OAuth client configuration.

## Storage abstraction

A `StorageProvider` interface with two implementations:

```typescript
interface StorageProvider {
  put(key: string, data: Buffer | Stream): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  url(key: string): string;
}
```

- `LocalFilesystemProvider` — writes to a configurable directory, default
  `./data/uploads/`. Used when `STORAGE_MODE=local` (the default).
- `S3CompatibleProvider` — writes to any S3-compatible service (R2, B2,
  AWS). Used when `STORAGE_MODE=s3`.

Used for CSV uploads, exported PDFs, and (in v2) org logos.

## Deployment model

**Default: Docker Compose**

```yaml
services:
  postgres:
    image: postgres:16
    volumes:
      - centerpeace-data:/var/lib/postgresql/data
  app:
    build: .
    depends_on:
      - postgres
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://...
      - AUTH_SECRET=...
      - STORAGE_MODE=local
      - AI_MODE=solver
```

**Alternative: Vercel + hosted Postgres**

The codebase deploys cleanly to Vercel. File storage in this scenario
requires S3-compatible configuration. Documented but not the primary path.

## Observability

Minimal in v1: structured logging via pino, error reporting hooks (Sentry-
compatible interface, no Sentry dependency). No analytics, no telemetry.
The app should run quietly.

## Performance targets

- Canvas: 60fps drag at 50 tables / 500 guests
- Constraint solver: < 1s for 500 guests / 50 tables
- Page load: < 2s on a typical broadband connection
- CSV import: 200 guests in < 5s end-to-end

## Security posture

- All API routes require authentication and org-scoped authorization.
- All user input validated via Zod at API boundaries.
- CSV imports parsed in a sandbox, no formula execution.
- Agent workspace files validated against schema on read; malformed
  responses surfaced to the user, never auto-applied.
- Passwords never logged. Auth secrets via environment variables only.
- CSP headers set, frame ancestors denied.

## Decisions explicitly deferred

- Real-time collaboration (CRDT or WebSocket-based)
- Floor plan / room features (stage, bar, walls)
- Mobile responsive canvas (works on desktop in v1)
- Multi-event templates
- CRM connectors (Salesforce, Bloomerang, etc.)
- Org branding upload UI (theming hooks exist, no admin UI)
