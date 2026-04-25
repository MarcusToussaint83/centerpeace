# Contributing to Centerpeace

Thanks for considering a contribution. Centerpeace is built for and by
nonprofits, and contributions of all kinds are welcome — code, docs,
design, bug reports, and stories about how you use it.

## Quick start

1. Fork the repo and clone your fork.
2. Run the [15-minute setup](README.md#15-minute-setup).
3. Create a branch: `git checkout -b your-feature-name`
4. Make your changes.
5. Run checks locally:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
6. Commit, push, open a PR against `main`.

## Local development

```bash
pnpm install
docker compose up postgres -d   # database only
pnpm dev                         # app in watch mode
```

`pnpm dev` runs the Next.js dev server with hot reload, plus the file
watcher for agent mode workspaces.

## Project structure

See [docs/architecture.md](docs/architecture.md) for the full layout.
Quick orientation:

- `apps/web` — Next.js app
- `packages/db` — Drizzle schema and migrations
- `packages/types` — shared TypeScript types
- `packages/constraints` — pure-function constraint solver
- `docs` — project documentation
- `examples` — sample CSVs, seed data

## What to work on

- **Issues labeled `good first issue`** — smaller, scoped tasks
- **Issues labeled `help wanted`** — areas where we'd especially welcome
  contributions
- **Issues labeled `bug`** — fixes always welcome
- **Documentation improvements** — typos, clarifications, new tutorials,
  always welcome without an issue

For larger features or architectural changes, please open an issue first
to discuss before writing code.

## Code style

- TypeScript strict mode, no `any` without explanation
- Prettier formatting (config in repo, run on save)
- ESLint rules enforced in CI
- Component naming: PascalCase
- Hook naming: useCamelCase
- File naming: kebab-case for utility files, PascalCase for components

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add place card export`
- `fix: correct constraint violation rendering`
- `docs: clarify agent mode setup`
- `refactor: extract canvas viewport hook`
- `test: cover solver unsatisfiable cases`
- `chore: bump dependencies`

## Pull requests

- Reference the issue number if applicable: `Closes #42`
- Describe what changed and why
- Include screenshots or screen recordings for UI changes
- All CI checks must pass
- A maintainer will review within a week

## Testing

- Unit tests for the constraint solver (required for any solver change)
- Manual QA for canvas interactions (we don't run Playwright in v1)
- If your change affects the database schema, include the migration

## Reporting bugs

Open an issue with:

- Steps to reproduce
- What you expected
- What actually happened
- Screenshots if applicable
- Your deployment context (docker compose, Vercel, etc.)
- Browser and OS

## Reporting security issues

Please do not file public issues for security vulnerabilities. Email
[security email — to be set up] with details. We'll respond within 72
hours.

## Community standards

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Be kind, be patient, assume
good faith.

## Recognition

Contributors are credited in release notes and on the project website
(once we have one). Significant ongoing contributors may be invited to
join the maintainer team.
