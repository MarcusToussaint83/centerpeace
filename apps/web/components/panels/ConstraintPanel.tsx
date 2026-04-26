"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Link2,
  Plus,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { useEventStore, evaluateConstraints } from "@/lib/store";
import type { ConstraintKind, EvaluatedConstraint } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ConstraintPanel() {
  const constraints = useEventStore((s) => s.constraints);
  const assignments = useEventStore((s) => s.assignments);
  const evaluated = React.useMemo(
    () => evaluateConstraints(constraints, assignments),
    [constraints, assignments],
  );
  const removeConstraint = useEventStore((s) => s.removeConstraint);
  const guests = useEventStore((s) => s.guests);

  const [adding, setAdding] = React.useState(false);

  const violations = evaluated.filter((c) => c.status === "violated").length;
  const satisfied = evaluated.filter((c) => c.status === "satisfied").length;
  const pending = evaluated.filter((c) => c.status === "pending").length;

  const guestName = (id: string) =>
    guests.find((g) => g.id === id)?.name ?? "Unknown";

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold tracking-tight">
            <Link2 className="size-4 text-muted-foreground" />
            Constraints
          </h2>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              violations > 0
                ? "bg-destructive/15 text-destructive"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {violations > 0
              ? `${violations} violation${violations === 1 ? "" : "s"}`
              : "All clear"}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check className="size-3 text-emerald-600" /> {satisfied}
          </span>
          <span className="flex items-center gap-1">
            <CircleDashed className="size-3" /> {pending}
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="size-3 text-destructive" /> {violations}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {evaluated.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No constraints yet. Add a rule like &ldquo;Naomi must sit with
            Henry&rdquo; and watch the canvas update live.
          </p>
        )}
        <ul className="space-y-1 px-2">
          {evaluated.map((c) => (
            <ConstraintRow
              key={c.id}
              c={c}
              nameA={guestName(c.a)}
              nameB={guestName(c.b)}
              onDelete={() => removeConstraint(c.id)}
            />
          ))}
        </ul>
      </div>

      <div className="border-t border-border p-3">
        {adding ? (
          <AddConstraintForm onClose={() => setAdding(false)} />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-input bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-input/80 hover:bg-secondary/40 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Add constraint
          </button>
        )}
      </div>
    </aside>
  );
}

function ConstraintRow({
  c,
  nameA,
  nameB,
  onDelete,
}: {
  c: EvaluatedConstraint;
  nameA: string;
  nameB: string;
  onDelete: () => void;
}) {
  const positive = c.kind === "must-sit-with";
  const status = c.status;

  const badge =
    status === "violated"
      ? {
          icon: <AlertTriangle className="size-3" />,
          label: "Violated",
          cls: "bg-destructive/15 text-destructive",
        }
      : status === "satisfied"
        ? {
            icon: <Check className="size-3" />,
            label: "Satisfied",
            cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
          }
        : {
            icon: <CircleDashed className="size-3" />,
            label: "Pending",
            cls: "bg-secondary text-muted-foreground",
          };

  const KindIcon = positive ? Link2 : Unlink;

  return (
    <li
      className={cn(
        "group rounded-md border bg-background px-2.5 py-2 text-sm transition-colors",
        status === "violated"
          ? "border-destructive/30"
          : "border-border hover:border-input",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <KindIcon
              className={cn(
                "size-3.5 shrink-0",
                positive ? "text-emerald-600" : "text-destructive",
              )}
            />
            <span className="truncate" title={nameA}>
              {nameA}
            </span>
            <span className="text-muted-foreground">
              {positive ? "+" : "≠"}
            </span>
            <span className="truncate" title={nameB}>
              {nameB}
            </span>
          </div>
          {c.note && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {c.note}
            </p>
          )}
        </div>
        <button
          onClick={onDelete}
          aria-label="Delete constraint"
          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="mt-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            badge.cls,
          )}
        >
          {badge.icon}
          {badge.label}
        </span>
      </div>
    </li>
  );
}

function AddConstraintForm({ onClose }: { onClose: () => void }) {
  const guests = useEventStore((s) => s.guests);
  const addConstraint = useEventStore((s) => s.addConstraint);

  const [kind, setKind] = React.useState<ConstraintKind>("must-sit-with");
  const [a, setA] = React.useState("");
  const [b, setB] = React.useState("");
  const [note, setNote] = React.useState("");

  const canSubmit = a && b && a !== b;

  const submit = () => {
    if (!canSubmit) return;
    addConstraint({ kind, a, b, note: note.trim() || undefined });
    onClose();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          New constraint
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-secondary"
          aria-label="Cancel"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-md bg-secondary/60 p-0.5">
        {(
          [
            { v: "must-sit-with", label: "Must sit with" },
            { v: "must-not-sit-with", label: "Must NOT" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setKind(opt.v)}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              kind === opt.v
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <select
        value={a}
        onChange={(e) => setA(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Choose guest A…</option>
        {guests.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      <select
        value={b}
        onChange={(e) => setB(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Choose guest B…</option>
        {guests
          .filter((g) => g.id !== a)
          .map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
      </select>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Add constraint
      </button>
    </form>
  );
}
