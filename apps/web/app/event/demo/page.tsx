"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Github } from "lucide-react";
import { ConstraintPanel } from "@/components/panels/ConstraintPanel";
import { GuestPanel } from "@/components/panels/GuestPanel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useEventStore, selectViolationCount } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Wraps a side panel with a smooth slide-collapse and a visible tab on the
 * inner edge so users can toggle it without hunting for a button.
 *
 * side="left"  → panel slides left to hide, tab appears on its right edge
 * side="right" → panel slides right to hide, tab appears on its left edge
 */
function CollapsiblePanel({
  side,
  label,
  badge,
  children,
}: {
  side: "left" | "right";
  label: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);

  const tabIcon = side === "left"
    ? (open ? <ChevronLeft className="size-3" /> : <ChevronRight className="size-3" />)
    : (open ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />);

  return (
    <div className={cn("relative flex h-full shrink-0", side === "right" && "flex-row-reverse")}>
      {/* Sliding panel */}
      <div
        className={cn(
          "flex h-full w-72 flex-col overflow-hidden transition-all duration-200 ease-in-out",
          open ? "w-72 opacity-100" : "w-0 opacity-0",
        )}
        aria-hidden={!open}
      >
        {children}
      </div>

      {/* Collapse tab — sits flush on the inner edge */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? `Collapse ${label} panel` : `Expand ${label} panel`}
        title={open ? `Collapse ${label}` : `Expand ${label}`}
        className={cn(
          "group flex flex-col items-center justify-center gap-1 border-border bg-card px-1 py-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
          side === "left"
            ? "border-r"
            : "border-l",
        )}
      >
        {tabIcon}
        {badge && <span className="mt-0.5">{badge}</span>}
        <span
          className="writing-mode-vertical-lr text-[9px]"
          style={{ writingMode: "vertical-lr", transform: side === "left" ? "none" : "rotate(180deg)" }}
        >
          {label}
        </span>
      </button>
    </div>
  );
}

const EventCanvas = dynamic(
  () => import("@/components/canvas/EventCanvas").then((m) => m.EventCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        Preparing the room…
      </div>
    ),
  },
);

export default function EventDemoPage() {
  const eventName = useEventStore((s) => s.name);
  const violations = useEventStore(selectViolationCount);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    useEventStore.persist.rehydrate();
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading event…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="gap-1.5">
              <ArrowLeft className="size-4" />
              Home
            </Link>
          </Button>
          <span className="h-5 w-px bg-border" />
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Demo event
            </div>
            <h1 className="font-serif text-lg leading-none tracking-tight">
              {eventName}
            </h1>
          </div>
          <span
            className={cn(
              "ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              violations > 0
                ? "bg-destructive/15 text-destructive"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
            )}
            aria-live="polite"
          >
            {violations > 0
              ? `${violations} violation${violations === 1 ? "" : "s"}`
              : "All clear"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/MarcusToussaint83/centerpeace"
              target="_blank"
              rel="noreferrer"
            >
              <Github />
              GitHub
            </a>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CollapsiblePanel side="left" label="Guests">
          <GuestPanel />
        </CollapsiblePanel>
        <main className="relative min-w-0 flex-1 bg-[radial-gradient(circle_at_center,hsl(var(--secondary)),hsl(var(--background)))]">
          <EventCanvas />
        </main>
        <CollapsiblePanel
          side="right"
          label="Constraints"
          badge={
            violations > 0 ? (
              <span className="rounded-full bg-destructive/15 px-1 py-0.5 text-[8px] font-bold text-destructive">
                {violations}
              </span>
            ) : null
          }
        >
          <ConstraintPanel />
        </CollapsiblePanel>
      </div>
    </div>
  );
}
