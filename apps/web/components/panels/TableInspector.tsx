"use client";

import * as React from "react";
import {
  Circle as CircleIcon,
  RectangleHorizontal,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";

import { useEventStore, selectTableOccupancy } from "@/lib/store";
import type { TableShape } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Floating inspector for the currently-selected table.
 *
 * Lives inside the canvas region (positioned absolutely) so it doesn't push
 * the panels around. Auto-hides when nothing is selected.
 */
export function TableInspector() {
  const selectedId = useEventStore((s) => s.selectedTableId);
  const tables = useEventStore((s) => s.tables);
  const updateTable = useEventStore((s) => s.updateTable);
  const removeTable = useEventStore((s) => s.removeTable);
  const selectTable = useEventStore((s) => s.selectTable);
  const occupancy = useEventStore((s) =>
    selectedId ? selectTableOccupancy(selectedId)(s) : null,
  );

  const table = tables.find((t) => t.id === selectedId);
  if (!table) return null;

  const setShape = (shape: TableShape) => {
    // Round capacities don't need to be even; rect must be even.
    const cap = shape === "rect" && table.capacity % 2 !== 0 ? table.capacity + 1 : table.capacity;
    updateTable(table.id, { shape, capacity: cap });
  };

  const setCapacity = (delta: number) => {
    const min = 2;
    const max = 16;
    const step = table.shape === "rect" ? 2 : 1;
    const next = Math.max(min, Math.min(max, table.capacity + delta * step));
    updateTable(table.id, { capacity: next });
  };

  const rotateBy = (deg: number) => {
    updateTable(table.id, { rotation: table.rotation + (deg * Math.PI) / 180 });
  };

  const onDelete = () => {
    if (occupancy && occupancy.seated > 0) {
      if (
        !confirm(
          `${table.label} has ${occupancy.seated} guest${occupancy.seated === 1 ? "" : "s"} seated. Delete anyway?`,
        )
      )
        return;
    }
    removeTable(table.id);
  };

  return (
    <div className="pointer-events-auto absolute right-4 top-4 w-72 rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Table inspector
        </span>
        <button
          onClick={() => selectTable(null)}
          className="rounded p-1 text-muted-foreground hover:bg-secondary"
          aria-label="Close inspector"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="space-y-3 p-3">
        <input
          value={table.label}
          onChange={(e) => updateTable(table.id, { label: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <input
          value={table.purpose ?? ""}
          onChange={(e) => updateTable(table.id, { purpose: e.target.value })}
          placeholder="Purpose (e.g., Major donors)"
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-muted-foreground focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Shape
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-secondary/60 p-0.5">
            {(
              [
                { v: "round", icon: CircleIcon, label: "Round" },
                { v: "rect", icon: RectangleHorizontal, label: "Rect" },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.v}
                  onClick={() => setShape(opt.v)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
                    table.shape === opt.v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Seats
            </div>
            <div className="text-xs text-muted-foreground">
              {occupancy?.seated ?? 0} / {table.capacity}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCapacity(-1)}
              className="flex h-7 flex-1 items-center justify-center rounded border border-input text-sm hover:bg-secondary"
            >
              −
            </button>
            <span className="min-w-[3ch] text-center font-mono text-sm">
              {table.capacity}
            </span>
            <button
              onClick={() => setCapacity(+1)}
              className="flex h-7 flex-1 items-center justify-center rounded border border-input text-sm hover:bg-secondary"
            >
              +
            </button>
          </div>
          {table.shape === "rect" && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Rectangular tables seat in pairs (one on each long side).
            </p>
          )}
        </div>

        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Rotation
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => rotateBy(-15)}
              className="flex h-7 flex-1 items-center justify-center rounded border border-input text-xs hover:bg-secondary"
            >
              −15°
            </button>
            <button
              onClick={() => rotateBy(+15)}
              className="flex h-7 flex-1 items-center justify-center gap-1 rounded border border-input text-xs hover:bg-secondary"
            >
              <RotateCw className="size-3" />
              +15°
            </button>
            <button
              onClick={() => updateTable(table.id, { rotation: 0 })}
              className="h-7 rounded px-2 text-xs text-muted-foreground hover:bg-secondary"
            >
              Reset
            </button>
          </div>
        </div>

        <button
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
          Delete table
        </button>
      </div>
    </div>
  );
}
