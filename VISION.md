# Centerpeace — Vision

## What it is

Centerpeace is an open-source seating chart tool for nonprofit fundraising
events. It helps development teams arrange dinner guests across tables,
collaborate on placements, and produce print-ready materials for event night.

## Who it's for

Development directors, event managers, and major gifts officers at nonprofits
of any size. The team that knows which donor should sit next to which board
member, and why. People who currently do this work in spreadsheets, sticky
notes, or expensive proprietary tools.

## The problem

Seating a fundraising dinner is a high-stakes, multi-stakeholder, deeply
relational task. The development team weighs cultivation strategy. The
executive director has opinions about which prospects need attention.
Major gifts officers advocate for their portfolios. Constraints multiply:
spouses together, ex-spouses apart, this donor near the stage, that one
near their assigned officer.

Existing tools fall into three categories:

- **Spreadsheets** — fast to start, painful to revise, no visualization.
- **Generic event software** — seating is an afterthought, no relationship
  intelligence, expensive per-event pricing.
- **High-end proprietary tools** — capable but cost $500-$2000 per event,
  out of reach for most nonprofits.

None of them treat seating as the relationship problem it actually is, and
none of them respect that nonprofits run lean.

## What we're building

A web app where event teams:

- Import guests from a CRM export
- Lay out their venue with circular and rectangular tables
- Drag guests to seats with constraints, comments, and version history
- Get AI assistance for strategic placement — using their own AI tools
  (Claude Cowork, Claude Code, ChatGPT desktop) or via API keys, or not
  at all
- Export print-ready seating charts, place cards, and table cards

## Design principles

**1. Premium feel from the first interaction.** Nonprofits deserve software
that looks and feels like the tools their donors use at work. Animations,
micro-interactions, and polish are not optional.

**2. Bring your own AI.** Every nonprofit has a different relationship with
AI — some have API budgets, some have Claude Pro subscriptions, some have
neither. Centerpeace works with all three, and works fully without any AI.

**3. Graceful degradation everywhere.** No AI key? Constraint solver still
works. No CRM? Manual entry works. No internet? Self-hosted instances run
fully offline. Every feature has a fallback.

**4. Self-hosting as a first-class deployment.** A nonprofit IT volunteer
should clone the repo, run `docker compose up`, and be in business within
fifteen minutes.

**5. Accessibility is non-negotiable.** Keyboard navigation, screen reader
support, color contrast, and a non-canvas list view of the same data are
table stakes.

**6. Open by default.** MIT licensed. Public roadmap. Contributors welcomed.
The project belongs to the nonprofit ecosystem it serves.

## What we're explicitly not

- Not a CRM. We import from yours.
- Not a full event management platform. We do seating well, not registration,
  ticketing, or fundraising.
- Not a SaaS product (yet). Self-hosted is the primary deployment.
- Not real-time collaborative. Comments and version history are intentional
  alternatives that fit how seating decisions actually get made.
