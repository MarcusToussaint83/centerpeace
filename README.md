# Centerpeace

> Open-source seating chart tool for nonprofit fundraising events.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Centerpeace helps development teams plan seating for fundraising dinners.
Drag guests to tables, manage constraints, collaborate with comments, and
export print-ready charts for event night. Bring your own AI — works with
Claude Cowork, Claude Code, API keys, or no AI at all.

![screenshot placeholder]

## Why Centerpeace

Seating a fundraising dinner is a relationship problem dressed up as a
logistics problem. Existing tools either treat it as a spreadsheet
exercise or charge $500-$2000 per event. Centerpeace is built specifically
for the development team workflow — strategic placement, constraint
management, multi-stakeholder review — and it's free, open source, and
self-hostable.

## Features

- **Visual seating canvas** with drag-and-drop, premium animation,
  pan/zoom, and snap-to-grid
- **Guest import** from any CRM via CSV with column mapping and
  reusable templates
- **Constraint management**: must-sit-with, must-not-sit-with, locked
  seats, accessibility flags, table capacity
- **Three AI modes** — solver-only (no LLM, always works), API mode
  (Anthropic, OpenAI, Google, Ollama), or agent mode (point your own
  Claude Cowork or Claude Code at a workspace folder)
- **Comments and version history** for multi-stakeholder review
- **Print-ready exports**: wall charts, guest lists, place cards,
  table cards
- **Self-hosted** by default — your data stays on your infrastructure
- **Accessible** — keyboard navigation, screen reader support,
  non-canvas list view of all data

## 15-minute setup

```bash
git clone https://github.com/MarcusToussaint83/centerpeace.git
cd centerpeace
cp .env.example .env
docker compose up
```

Open http://localhost:3000, sign up, and you're in.

For production deployment, see [docs/deployment.md](docs/deployment.md) (coming soon).

## AI modes — bring your own AI

Centerpeace's AI features work in three modes:

**Solver mode** (default): a deterministic constraint solver handles
hard rules. No LLM, no keys, no costs. Always works.

**API mode**: connect an Anthropic, OpenAI, Google, or Ollama API key
for soft optimization with natural-language reasoning. Configured via
environment variables.

**Agent mode**: point your own AI agent (Claude Cowork, Claude Code,
Cursor, ChatGPT desktop) at a workspace folder. Centerpeace writes
structured files; your agent reads, reasons, and writes back proposals.
No API keys needed — uses your existing AI subscription.

See [AI_INTEGRATION.md](./AI_INTEGRATION.md) for setup guides.

### Agent mode in 30 seconds

If you have Claude Code, Claude Cowork, Cursor, or any other coding agent:

1. Open Centerpeace, click **⌂ Workspace** in the canvas toolbar.
2. Confirm the default workspace path (`~/Documents/Centerpeace/<event>/`).
   Centerpeace bootstraps the folder with a README, schemas, and a live
   snapshot of your event.
3. In your agent (e.g. Claude Code), `cd` into that folder and say
   "process the latest request". Centerpeace will already be syncing
   `current-state.json` as you edit.
4. Click **+ Generate request…** in Centerpeace, pick a request type, and
   optionally leave a note. A request file appears in `requests/`.
5. Your agent writes a response to `responses/`. Centerpeace validates
   it and surfaces a proposal card on the canvas.
6. **Accept** to apply the moves (a version snapshot is taken first), or
   **Reject** to archive it.

No API keys. Uses your existing agent subscription. Your data never
leaves your machine.

## Documentation

- [Vision](./VISION.md) — what we're building and why
- [Architecture](./ARCHITECTURE.md) — technical overview
- [Data model](./DATA_MODEL.md) — schema reference
- [Agent workspace spec](./AGENT_WORKSPACE_SPEC.md) — file format for
  agent mode integrations
- [AI integration](./AI_INTEGRATION.md) — configuring all three modes
- [Build plan](./BUILD_PLAN.md) — milestones to v1
- [Contributing](./CONTRIBUTING.md) — how to get involved
- [Code of conduct](./CODE_OF_CONDUCT.md)

## Tech stack

Next.js 15, TypeScript, Tailwind + shadcn/ui, react-konva, Postgres,
Drizzle, Auth.js, Framer Motion, Vercel AI SDK.

## Status

Pre-1.0. Building toward v1 launch. See [BUILD_PLAN.md](./BUILD_PLAN.md)
for milestone progress.

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

Built for the nonprofit ecosystem, starting with Seed Company. Inspired by
the development teams who do hard relational work to fund mission-driven
organizations.
