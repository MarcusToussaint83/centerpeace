import Link from "next/link";
import {
  ArrowRight,
  Github,
  LayoutGrid,
  Sparkles,
  ShieldCheck,
  Users,
  FileText,
  KeyRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const REPO_URL = "https://github.com/MarcusToussaint83/centerpeace";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackgroundGlow />
      <SiteHeader />

      <main className="relative">
        <Hero />
        <Features />
        <AiModes />
        <Quickstart />
        <Closing />
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="relative z-10">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          <span>Centerpeace</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="#features">Features</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="#ai">AI modes</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="#quickstart">Setup</Link>
          </Button>
          <ThemeToggle />
          <Button size="sm" asChild>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              <Github />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="container relative pt-16 pb-24 sm:pt-24 sm:pb-32">
      <div className="mx-auto max-w-3xl animate-fade-in text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Pre-1.0 · Building in the open
        </span>
        <h1 className="mt-6 font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Seating that honors{" "}
          <span className="italic text-primary">every relationship</span> in the room.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
          Centerpeace is an open-source seating chart tool built for the
          development teams behind nonprofit fundraising dinners. Drag guests
          to tables, manage constraints, collaborate, and export print-ready
          charts for event night.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/event/demo">
              Try the live demo
              <ArrowRight />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              <Github />
              Star on GitHub
            </a>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          MIT licensed · Self-hosted · No telemetry
        </p>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: LayoutGrid,
      title: "Visual seating canvas",
      body: "Premium drag-and-drop with pan, zoom, snap-to-grid, multi-select, and undo. Designed to feel great at 50 tables and 500 guests.",
    },
    {
      icon: Users,
      title: "Constraints that matter",
      body: "Must-sit-with, must-not-sit-with, locked seats, accessibility flags, and table capacity — all visualized live as you place guests.",
    },
    {
      icon: Sparkles,
      title: "Three AI modes",
      body: "Solver-only (no LLM, always works), API mode for Anthropic / OpenAI / Google / Ollama, or agent mode pointed at your own AI.",
    },
    {
      icon: FileText,
      title: "Print-ready exports",
      body: "Wall charts, master lists, place cards, and table cards. Click once on event day, hand the PDF to your printer.",
    },
    {
      icon: ShieldCheck,
      title: "Self-hosted by default",
      body: "Docker Compose up. Your guest data lives on your infrastructure. Optional Vercel + Postgres deploy for hosted teams.",
    },
    {
      icon: KeyRound,
      title: "Made for collaboration",
      body: "Multi-org, role-based access, threaded comments, version history. Built for development teams reviewing seating together.",
    },
  ];

  return (
    <section id="features" className="container py-20 sm:py-28">
      <SectionHeading
        eyebrow="What it does"
        title="Built for the actual seating workflow"
        body="Existing tools treat seating as a spreadsheet exercise or charge $500-$2,000 per event. Centerpeace is purpose-built for the way development teams actually do this work."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AiModes() {
  const modes = [
    {
      tag: "Default",
      title: "Solver mode",
      body: "A deterministic constraint solver handles hard rules. Runs in milliseconds. No LLM, no keys, no costs. Always works.",
    },
    {
      tag: "Connected",
      title: "API mode",
      body: "Bring an Anthropic, OpenAI, Google, or Ollama key for soft optimization and natural-language explanations of arrangements.",
    },
    {
      tag: "BYO agent",
      title: "Agent mode",
      body: "Point Claude Cowork, Claude Code, or Cursor at a workspace folder. The app writes structured files; your agent proposes back.",
    },
  ];

  return (
    <section id="ai" className="relative border-y border-border bg-secondary/40">
      <div className="container py-20 sm:py-28">
        <SectionHeading
          eyebrow="Bring your own AI"
          title="Three modes, one product"
          body="Every AI feature in Centerpeace has a deterministic floor. Layer on whichever LLM workflow fits your org — or none."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {modes.map((m, i) => (
            <div
              key={m.title}
              className="relative overflow-hidden rounded-xl border border-border bg-card p-6"
            >
              <span className="absolute right-4 top-4 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {m.tag}
              </span>
              <div className="font-mono text-xs text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="mt-3 font-serif text-2xl tracking-tight">{m.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Quickstart() {
  return (
    <section id="quickstart" className="container py-20 sm:py-28">
      <SectionHeading
        eyebrow="Get started"
        title="Up and running in 15 minutes"
        body="One command. Postgres and the app come up together. Sign up locally and you're in."
      />
      <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-border bg-card p-1 shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
          </div>
          <span className="font-mono">~/centerpeace</span>
        </div>
        <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed">
          <code>
            <span className="text-muted-foreground"># Clone, configure, run</span>
            {"\n"}
            <span className="text-primary">git clone</span> {REPO_URL}
            {"\n"}
            <span className="text-primary">cd</span> centerpeace{"\n"}
            <span className="text-primary">cp</span> .env.example .env{"\n"}
            <span className="text-primary">docker compose up</span>
            {"\n\n"}
            <span className="text-muted-foreground">
              # Open http://localhost:3000
            </span>
          </code>
        </pre>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="container pb-24 sm:pb-32">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-10 text-center sm:p-14">
        <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">
          Build it with us.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
          Centerpeace is open source under the MIT license. Issues, pull
          requests, and seating war stories all welcome.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              <Github />
              Open the repo
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a
              href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noreferrer"
            >
              Contributing guide
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="py-6 text-center text-xs text-muted-foreground">
      © 2026 Marcus Toussaint
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
        {eyebrow}
      </div>
      <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">{title}</h2>
      <p className="mt-4 text-balance text-muted-foreground">{body}</p>
    </div>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        <circle cx="12" cy="3.5" r="1.2" fill="currentColor" />
        <circle cx="12" cy="20.5" r="1.2" fill="currentColor" />
        <circle cx="3.5" cy="12" r="1.2" fill="currentColor" />
        <circle cx="20.5" cy="12" r="1.2" fill="currentColor" />
      </svg>
    </span>
  );
}

function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[600px] overflow-hidden">
      <div className="absolute left-1/2 top-[-200px] h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute left-[20%] top-[100px] h-[300px] w-[400px] rounded-full bg-accent/15 blur-3xl" />
    </div>
  );
}
