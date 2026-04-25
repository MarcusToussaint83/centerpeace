"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Github } from "lucide-react";

import { GuestPanel } from "@/components/panels/GuestPanel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useEventStore } from "@/lib/store";

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
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    Promise.resolve(useEventStore.persist.rehydrate()).finally(() =>
      setHydrated(true),
    );
  }, []);

  if (!hydrated) {
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

      <div className="flex min-h-0 flex-1">
        <GuestPanel />
        <main className="relative min-w-0 flex-1 bg-[radial-gradient(circle_at_center,hsl(var(--secondary)),hsl(var(--background)))]">
          <EventCanvas />
        </main>
      </div>
    </div>
  );
}
