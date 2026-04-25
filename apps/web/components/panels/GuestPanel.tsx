"use client";

import * as React from "react";
import { Search, Users, X } from "lucide-react";

import { useShallow } from "zustand/react/shallow";

import { useEventStore, selectUnseatedGuests } from "@/lib/store";
import { parseSeatKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GuestPanel() {
  const unseated = useEventStore(useShallow(selectUnseatedGuests));
  const guests = useEventStore((s) => s.guests);
  const tables = useEventStore((s) => s.tables);
  const assignments = useEventStore((s) => s.assignments);
  const pickedGuestId = useEventStore((s) => s.pickedGuestId);
  const pickGuest = useEventStore((s) => s.pickGuest);

  const seated = guests.filter((g) =>
    Object.values(assignments).includes(g.id),
  );

  const [query, setQuery] = React.useState("");
  const filterFn = React.useCallback(
    (name: string, affiliation?: string) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        name.toLowerCase().includes(q) ||
        (affiliation?.toLowerCase().includes(q) ?? false)
      );
    },
    [query],
  );

  return (
    <aside className="flex h-full w-80 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold tracking-tight">
            <Users className="size-4 text-muted-foreground" />
            Guests
          </h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {seated.length}/{guests.length} seated
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or affiliation"
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section
          title="Unseated"
          count={unseated.filter((g) => filterFn(g.name, g.affiliation)).length}
        >
          {unseated
            .filter((g) => filterFn(g.name, g.affiliation))
            .map((g) => (
              <GuestRow
                key={g.id}
                name={g.name}
                affiliation={g.affiliation}
                picked={pickedGuestId === g.id}
                onClick={() => pickGuest(g.id)}
              />
            ))}
          {unseated.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Everyone is seated. Nice work.
            </p>
          )}
        </Section>

        <Section
          title="Seated"
          count={seated.filter((g) => filterFn(g.name, g.affiliation)).length}
        >
          {seated
            .filter((g) => filterFn(g.name, g.affiliation))
            .map((g) => {
              const seatKey = Object.entries(assignments).find(
                ([, v]) => v === g.id,
              )?.[0];
              const tableLabel = seatKey
                ? tables.find((t) => t.id === parseSeatKey(seatKey).tableId)?.label
                : undefined;
              return (
                <GuestRow
                  key={g.id}
                  name={g.name}
                  affiliation={g.affiliation}
                  meta={tableLabel}
                  picked={pickedGuestId === g.id}
                  onClick={() => pickGuest(g.id)}
                />
              );
            })}
        </Section>
      </div>

      <div className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Click a guest to pick them up, then click a seat. Click a seated guest
        to move them. Click them again to unseat.
      </div>
    </aside>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="sticky top-0 z-[1] flex items-center justify-between bg-card/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
        <span>{title}</span>
        <span>{count}</span>
      </div>
      <ul className="px-1.5">{children}</ul>
    </div>
  );
}

function GuestRow({
  name,
  affiliation,
  meta,
  picked,
  onClick,
}: {
  name: string;
  affiliation?: string;
  meta?: string;
  picked: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
          picked
            ? "bg-primary text-primary-foreground"
            : "hover:bg-secondary/70",
        )}
      >
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
            picked
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-secondary text-foreground",
          )}
        >
          {initialsOf(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          {affiliation && (
            <div
              className={cn(
                "truncate text-xs",
                picked ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {affiliation}
            </div>
          )}
        </div>
        {meta && (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              picked
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {meta}
          </span>
        )}
      </button>
    </li>
  );
}

function initialsOf(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}
