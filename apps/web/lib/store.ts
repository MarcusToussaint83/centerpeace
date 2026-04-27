"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { autoSeat as runAutoSeat } from "./auto-seat";
import { placeTables } from "./place-tables";
import { buildDemoEvent } from "./seed";
import {
  type Constraint,
  type ConstraintKind,
  type EvaluatedConstraint,
  type EventState,
  type GuestId,
  type SeatKey,
  type CenterpeaceTable,
  parseSeatKey,
} from "./types";

interface SelectionState {
  /** Guest currently "picked up" via click-to-place. */
  pickedGuestId: GuestId | null;
  /** Selected table on the canvas (for properties / nudges later). */
  selectedTableId: string | null;
}

interface UIState {
  /** Pan/zoom state of the konva stage. */
  camera: { x: number; y: number; scale: number };
}

/**
 * Point-in-time snapshot of the event itself (no UI state).
 * Persisted so users can restore arrangements without leaving the tab.
 */
export interface VersionSnapshot {
  id: string;
  label: string;
  createdAt: number;
  state: EventState;
}

interface VersionsState {
  versions: VersionSnapshot[];
}

interface WorkspaceState {
  /** Absolute path to the agent workspace folder, or null when unconfigured. */
  workspacePath: string | null;
  /** ISO timestamp of the last successful sync, or null. */
  lastSyncAt: string | null;
}

export type AIProvider = "anthropic" | "openai";

interface AISettingsState {
  /** Configured BYOK provider, or null when unconfigured. */
  aiProvider: AIProvider | null;
  /** Model identifier passed to the provider (e.g. claude-3-5-sonnet-latest). */
  aiModel: string | null;
  /** API key. Stored in localStorage, sent only to /api/ai/chat per request. */
  aiKey: string | null;
}

interface Actions {
  reset(): void;

  pickGuest(id: GuestId | null): void;
  selectTable(id: string | null): void;

  /** Place the picked guest into seat. If the seat is occupied, swap. */
  placeAtSeat(seat: SeatKey): void;
  /** Unseat the guest currently at this seat. */
  clearSeat(seat: SeatKey): void;
  /** Move a guest already on the chart to a new seat. */
  moveGuestToSeat(guestId: GuestId, seat: SeatKey): void;

  setCamera(camera: Partial<UIState["camera"]>): void;
  moveTable(tableId: string, x: number, y: number): void;
  updateTable(tableId: string, patch: Partial<CenterpeaceTable>): void;
  /** Add a new table; returns its id so callers can immediately select it. */
  addTable(input?: Partial<CenterpeaceTable>): string;
  removeTable(tableId: string): void;

  addConstraint(input: { kind: ConstraintKind; a: GuestId; b: GuestId; note?: string }): void;
  removeConstraint(id: string): void;

  /** Apply a batch of seat -> guest placements (overwrites existing, ignores empty). */
  applyPlacements(placements: Record<SeatKey, GuestId>): void;
  /**
   * Atomically apply a change from the unified pipeline (file watcher, chat
   * tool, etc.). All sources of agent-driven mutation funnel through here so
   * the version-snapshot + conflict-handling logic only lives in one place.
   */
  applyChange(change: {
    assignments?: Record<SeatKey, GuestId>;
    removeAssignments?: SeatKey[];
    addConstraints?: Array<{
      kind: ConstraintKind;
      guestAId: GuestId;
      guestBId: GuestId;
      note?: string;
    }>;
    removeConstraints?: string[];
    /**
     * New tables to create. `x` and `y` are optional — if omitted (or if the
     * provided coordinates collide with an existing table) Centerpeace runs
     * a grid-sweep packer so multiple tables don't pile up on one spot.
     */
    addTables?: Array<{
      label?: string;
      shape?: "round" | "rect";
      capacity?: number;
      x?: number;
      y?: number;
      rotation?: number;
    }>;
    /** Existing table ids to remove (also clears their seat assignments). */
    removeTables?: string[];
    /** Patches keyed by table id (e.g. relabel, resize, move). */
    updateTables?: Record<string, Partial<{
      label: string;
      shape: "round" | "rect";
      capacity: number;
      x: number;
      y: number;
      rotation: number;
    }>>;
    /** Optional label saved with the version snapshot. */
    label?: string;
  }): {
    moves: number;
    removed: number;
    constraintsAdded: number;
    constraintsRemoved: number;
    tablesAdded: number;
    tablesRemoved: number;
    tablesUpdated: number;
  };
  /** Run the deterministic auto-seater on the current state and return its result. */
  autoSeat(): import("./auto-seat").AutoSeatResult;
  /**
   * Clear all assignments and re-run the auto-seater on a fresh slate.
   * Returns the result plus the previous assignments so the caller can offer
   * an "undo" affordance to the user.
   */
  reseatAll(): import("./auto-seat").AutoSeatResult & {
    previousAssignments: Record<SeatKey, GuestId>;
  };
  /** Replace all assignments wholesale (used by undo). */
  setAssignments(assignments: Record<SeatKey, GuestId>): void;
  /** Append guests in bulk; ignores duplicate names. Returns number actually added. */
  importGuests(rows: Array<{ name: string; affiliation?: string; notes?: string }>): number;

  /** Capture the current event state as a named version and return its id. */
  saveVersion(label?: string): string;
  /** Restore a saved version wholesale. Clears selection/pickup. */
  restoreVersion(id: string): void;
  /** Delete a saved version. */
  deleteVersion(id: string): void;

  /** Set or clear the workspace path. Pass null to disconnect. */
  setWorkspacePath(p: string | null): void;
  /** Record the most recent successful sync. */
  markSynced(): void;

  /** Save BYOK provider configuration. Pass null fields to clear. */
  setAIConfig(input: { provider: AIProvider | null; model: string | null; key: string | null }): void;
}

export type Store = EventState & SelectionState & UIState & VersionsState & WorkspaceState & AISettingsState & Actions;

const initialEvent = buildDemoEvent();

export const useEventStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialEvent,
      pickedGuestId: null,
      selectedTableId: null,
      camera: { x: 0, y: 0, scale: 1 },
      versions: [],
      workspacePath: null,
      lastSyncAt: null,
      aiProvider: null,
      aiModel: null,
      aiKey: null,

      reset: () => {
        const fresh = buildDemoEvent();
        set({
          ...fresh,
          pickedGuestId: null,
          selectedTableId: null,
          camera: { x: 0, y: 0, scale: 1 },
        });
      },

      pickGuest: (id) =>
        set((s) => ({
          pickedGuestId: s.pickedGuestId === id ? null : id,
        })),

      selectTable: (id) => set({ selectedTableId: id }),

      placeAtSeat: (seat) => {
        const { pickedGuestId, assignments } = get();
        if (!pickedGuestId) return;

        const next: typeof assignments = { ...assignments };

        // If the picked guest is already seated elsewhere, clear that seat.
        for (const [k, v] of Object.entries(next)) {
          if (v === pickedGuestId) delete next[k];
        }

        // If the target seat is occupied, displaced guest becomes unseated.
        // (Could swap into the picked guest's old seat in a future iteration.)
        next[seat] = pickedGuestId;
        set({ assignments: next, pickedGuestId: null });
      },

      moveGuestToSeat: (guestId, seat) => {
        const { assignments } = get();
        const next: typeof assignments = { ...assignments };
        for (const [k, v] of Object.entries(next)) {
          if (v === guestId) delete next[k];
        }
        next[seat] = guestId;
        set({ assignments: next });
      },

      clearSeat: (seat) => {
        const { assignments } = get();
        if (!(seat in assignments)) return;
        const next: typeof assignments = { ...assignments };
        delete next[seat];
        set({ assignments: next });
      },

      setCamera: (patch) =>
        set((s) => ({ camera: { ...s.camera, ...patch } })),

      moveTable: (tableId, x, y) =>
        set((s) => ({
          tables: s.tables.map((t) => (t.id === tableId ? { ...t, x, y } : t)),
        })),

      updateTable: (tableId, patch) =>
        set((s) => ({
          tables: s.tables.map((t) => (t.id === tableId ? { ...t, ...patch } : t)),
        })),

      addTable: (input) => {
        const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
        // Default new table: round, 8 seats, dropped near canvas origin.
        const table: CenterpeaceTable = {
          id,
          label: input?.label ?? "New table",
          shape: input?.shape ?? "round",
          capacity: input?.capacity ?? 8,
          x: input?.x ?? 0,
          y: input?.y ?? 0,
          rotation: input?.rotation ?? 0,
          host: input?.host,
          purpose: input?.purpose,
        };
        set((s) => ({
          tables: [...s.tables, table],
          selectedTableId: id,
        }));
        return id;
      },

      removeTable: (tableId) =>
        set((s) => {
          // Drop seat assignments tied to this table so the constraint
          // evaluator doesn't surface ghosts.
          const nextAssignments: Record<string, string> = {};
          for (const [seat, guestId] of Object.entries(s.assignments)) {
            if (parseSeatKey(seat).tableId !== tableId) {
              nextAssignments[seat] = guestId;
            }
          }
          return {
            tables: s.tables.filter((t) => t.id !== tableId),
            assignments: nextAssignments,
            selectedTableId:
              s.selectedTableId === tableId ? null : s.selectedTableId,
          };
        }),

      addConstraint: ({ kind, a, b, note }) => {
        if (a === b) return;
        const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        set((s) => ({
          constraints: [...s.constraints, { id, kind, a, b, note }],
        }));
      },

      removeConstraint: (id) =>
        set((s) => ({
          constraints: s.constraints.filter((c) => c.id !== id),
        })),

      applyPlacements: (placements) =>
        set((s) => ({
          assignments: { ...s.assignments, ...placements },
          // Clear pickup state if the picked guest just got placed.
          pickedGuestId:
            s.pickedGuestId && Object.values(placements).includes(s.pickedGuestId)
              ? null
              : s.pickedGuestId,
        })),

      applyChange: (change) => {
        const moves = Object.keys(change.assignments ?? {}).length;
        const removed = (change.removeAssignments ?? []).length;
        const constraintsAdded = (change.addConstraints ?? []).length;
        const constraintsRemoved = (change.removeConstraints ?? []).length;
        const tablesAdded = (change.addTables ?? []).length;
        const tablesRemoved = (change.removeTables ?? []).length;
        const tablesUpdated = Object.keys(change.updateTables ?? {}).length;
        const total =
          moves + removed + constraintsAdded + constraintsRemoved + tablesAdded + tablesRemoved + tablesUpdated;
        if (total === 0) {
          return {
            moves: 0,
            removed: 0,
            constraintsAdded: 0,
            constraintsRemoved: 0,
            tablesAdded: 0,
            tablesRemoved: 0,
            tablesUpdated: 0,
          };
        }

        // Snapshot first so the user can always undo, regardless of source.
        const label = change.label ?? `Agent · ${[
          moves ? `${moves} move${moves === 1 ? "" : "s"}` : null,
          removed ? `${removed} cleared` : null,
          tablesAdded ? `${tablesAdded} table${tablesAdded === 1 ? "" : "s"} added` : null,
          tablesRemoved ? `${tablesRemoved} table${tablesRemoved === 1 ? "" : "s"} removed` : null,
          tablesUpdated ? `${tablesUpdated} table${tablesUpdated === 1 ? "" : "s"} edited` : null,
          constraintsAdded ? `${constraintsAdded} rule${constraintsAdded === 1 ? "" : "s"}` : null,
          constraintsRemoved ? `${constraintsRemoved} rule${constraintsRemoved === 1 ? "" : "s"} removed` : null,
        ].filter(Boolean).join(" + ")}`;
        get().saveVersion(label);

        set((s) => {
          // ----- Tables (do these first; affects assignment validity) -----
          let tables = s.tables;

          if (change.removeTables?.length) {
            const removeSet = new Set(change.removeTables);
            tables = tables.filter((t) => !removeSet.has(t.id));
          }

          if (change.updateTables) {
            tables = tables.map((t) => {
              const patch = change.updateTables?.[t.id];
              return patch ? { ...t, ...patch } : t;
            });
          }

          if (change.addTables?.length) {
            const pending = change.addTables.map((p) => ({
              shape: (p.shape ?? "round") as "round" | "rect",
              capacity: p.capacity ?? 8,
              x: p.x,
              y: p.y,
            }));
            const positions = placeTables({ existing: tables, pending });
            const fallbackLabel = (idx: number) =>
              `Table ${tables.length + idx + 1}`;
            const additions: typeof tables = change.addTables.map((p, i) => ({
              id: `t_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
              label: p.label ?? fallbackLabel(i),
              shape: (p.shape ?? "round") as "round" | "rect",
              capacity: p.capacity ?? 8,
              x: positions[i]?.x ?? 0,
              y: positions[i]?.y ?? 0,
              rotation: p.rotation ?? 0,
            }));
            tables = [...tables, ...additions];
          }

          // ----- Assignments -----
          // Drop assignments for any seats whose table no longer exists.
          const validTableIds = new Set(tables.map((t) => t.id));
          const next: Record<SeatKey, GuestId> = {};
          for (const [key, gid] of Object.entries(s.assignments)) {
            const [tid] = key.split(":");
            if (tid && validTableIds.has(tid)) next[key] = gid;
          }

          // Reverse-lookup so we can drop a guest from any prior seat when an
          // agent moves them somewhere new.
          if (change.assignments) {
            const incomingGuestIds = new Set(Object.values(change.assignments));
            for (const key of Object.keys(next)) {
              if (next[key] && incomingGuestIds.has(next[key]!)) delete next[key];
            }
            for (const [seat, gid] of Object.entries(change.assignments)) {
              const [tid] = seat.split(":");
              if (tid && validTableIds.has(tid)) next[seat] = gid;
            }
          }
          if (change.removeAssignments) {
            for (const seat of change.removeAssignments) delete next[seat];
          }

          // ----- Constraints -----
          let constraints = s.constraints;
          if (change.removeConstraints?.length) {
            const ids = new Set(change.removeConstraints);
            constraints = constraints.filter((c) => !ids.has(c.id));
          }
          if (change.addConstraints?.length) {
            const additions = change.addConstraints
              .filter((c) => c.guestAId !== c.guestBId)
              .map((c) => ({
                id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
                kind: c.kind,
                a: c.guestAId,
                b: c.guestBId,
                note: c.note,
              }));
            constraints = [...constraints, ...additions];
          }

          return { tables, assignments: next, constraints, pickedGuestId: null };
        });

        return {
          moves,
          removed,
          constraintsAdded,
          constraintsRemoved,
          tablesAdded,
          tablesRemoved,
          tablesUpdated,
        };
      },

      autoSeat: () => {
        const s = get();
        const result = runAutoSeat(s);
        if (Object.keys(result.placements).length > 0) {
          set((cur) => ({
            assignments: { ...cur.assignments, ...result.placements },
          }));
        }
        return result;
      },

      reseatAll: () => {
        const s = get();
        const previousAssignments = { ...s.assignments };
        // Auto-snapshot so users can restore even if they dismiss the toast.
        get().saveVersion("Before reseat all");
        // Run auto-seater against an emptied state so every guest is treated
        // as unseated. We call the pure helper directly with a synthetic state
        // to avoid mutating the store twice.
        const result = runAutoSeat({ ...s, assignments: {} });
        set(() => ({ assignments: result.placements, pickedGuestId: null }));
        return { ...result, previousAssignments };
      },

      setAssignments: (assignments) =>
        set(() => ({ assignments: { ...assignments }, pickedGuestId: null })),

      saveVersion: (label) => {
        const s = get();
        const id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const snapshot: VersionSnapshot = {
          id,
          label: (label && label.trim()) || new Date().toLocaleString(),
          createdAt: Date.now(),
          state: {
            id: s.id,
            name: s.name,
            guests: s.guests,
            tables: s.tables,
            assignments: s.assignments,
            constraints: s.constraints,
          },
        };
        // Cap at 25 versions to keep localStorage manageable; drop the oldest.
        set((cur) => ({
          versions: [snapshot, ...cur.versions].slice(0, 25),
        }));
        return id;
      },

      restoreVersion: (id) => {
        const v = get().versions.find((x) => x.id === id);
        if (!v) return;
        set(() => ({
          id: v.state.id,
          name: v.state.name,
          guests: v.state.guests,
          tables: v.state.tables,
          assignments: v.state.assignments,
          constraints: v.state.constraints,
          pickedGuestId: null,
          selectedTableId: null,
        }));
      },

      deleteVersion: (id) =>
        set((s) => ({ versions: s.versions.filter((v) => v.id !== id) })),

      setWorkspacePath: (p) => set({ workspacePath: p, lastSyncAt: null }),
      markSynced: () => set({ lastSyncAt: new Date().toISOString() }),

      setAIConfig: ({ provider, model, key }) =>
        set({ aiProvider: provider, aiModel: model, aiKey: key }),

      importGuests: (rows) => {
        const existing = new Set(
          get().guests.map((g) => g.name.trim().toLowerCase()),
        );
        const additions = rows
          .map((r) => ({
            name: r.name.trim(),
            affiliation: r.affiliation?.trim() || undefined,
            notes: r.notes?.trim() || undefined,
          }))
          .filter((r) => r.name && !existing.has(r.name.toLowerCase()))
          .map((r) => ({
            id: `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            ...r,
          }));
        if (additions.length === 0) return 0;
        set((s) => ({ guests: [...s.guests, ...additions] }));
        return additions.length;
      },
    }),
    {
      name: "centerpeace.event.demo",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? // No-op storage on the server so SSR doesn't try to read localStorage.
            {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
          : localStorage,
      ),
      // Don't persist transient UI state.
      partialize: (s) => ({
        id: s.id,
        name: s.name,
        guests: s.guests,
        tables: s.tables,
        assignments: s.assignments,
        constraints: s.constraints,
        versions: s.versions,
        workspacePath: s.workspacePath,
        aiProvider: s.aiProvider,
        aiModel: s.aiModel,
        aiKey: s.aiKey,
      }),
      version: 3,
      migrate: (persistedState, version) => {
        const s = (persistedState ?? {}) as Partial<EventState>;
        // Pre-launch reseed strategy: any version older than current resets
        // tables + constraints from the demo so we never have to think about
        // partial backfills. Users keep their seat assignments only when the
        // matching table still exists after reseed.
        if (version < 3) {
          const fresh = buildDemoEvent();
          return {
            ...fresh,
            // Preserve seat assignments that still point at a valid seat.
            assignments: Object.fromEntries(
              Object.entries(s.assignments ?? {}).filter(([seat]) => {
                const tableId = parseSeatKey(seat).tableId;
                return fresh.tables.some((t) => t.id === tableId);
              }),
            ),
          } as EventState;
        }
        return s as EventState;
      },
      skipHydration: true,
    },
  ),
);

// Derived selectors --------------------------------------------------------

export const selectGuestForSeat =
  (seat: SeatKey) =>
  (s: Store) => {
    const guestId = s.assignments[seat];
    if (!guestId) return undefined;
    return s.guests.find((g) => g.id === guestId);
  };

export const selectSeatForGuest =
  (guestId: GuestId) =>
  (s: Store): SeatKey | undefined => {
    for (const [k, v] of Object.entries(s.assignments)) {
      if (v === guestId) return k;
    }
    return undefined;
  };

export const selectUnseatedGuests = (s: Store) => {
  const seatedIds = new Set(Object.values(s.assignments));
  return s.guests.filter((g) => !seatedIds.has(g.id));
};

export const selectTableOccupancy =
  (tableId: string) =>
  (s: Store) => {
    let seated = 0;
    for (const [k] of Object.entries(s.assignments)) {
      if (parseSeatKey(k).tableId === tableId) seated++;
    }
    const table = s.tables.find((t) => t.id === tableId);
    return { seated, capacity: table?.capacity ?? 0 };
  };

/**
 * Evaluate every constraint against current seat assignments.
 *
 * Pure function so components can call it inside `useMemo` keyed on the
 * primitive `constraints` and `assignments` slices. Calling it as a zustand
 * selector returns a fresh array each render and triggers the
 * "getSnapshot should be cached" warning.
 *
 * - `must-sit-with`:     pending if either guest unseated; satisfied if same
 *                         table; violated if seated at different tables.
 * - `must-not-sit-with`: pending if either guest unseated; violated if same
 *                         table; satisfied if seated at different tables.
 */
export function evaluateConstraints(
  constraints: Constraint[],
  assignments: Record<SeatKey, GuestId>,
): EvaluatedConstraint[] {
  const seatOf: Record<GuestId, SeatKey> = {};
  for (const [seat, guestId] of Object.entries(assignments)) {
    seatOf[guestId] = seat;
  }

  return constraints.map((c): EvaluatedConstraint => {
    const sa = seatOf[c.a];
    const sb = seatOf[c.b];
    if (!sa || !sb) {
      return { ...c, status: "pending", seatA: sa, seatB: sb };
    }
    const sameTable = parseSeatKey(sa).tableId === parseSeatKey(sb).tableId;
    const status =
      c.kind === "must-sit-with"
        ? sameTable
          ? "satisfied"
          : "violated"
        : sameTable
          ? "violated"
          : "satisfied";
    return { ...c, status, seatA: sa, seatB: sb };
  });
}

/** Returns a stable number, safe to use as a direct zustand selector. */
export const selectViolationCount = (s: Store): number => {
  // Counting doesn't allocate, so this is fine to recompute per render.
  let n = 0;
  const seatOf: Record<GuestId, SeatKey> = {};
  for (const [seat, guestId] of Object.entries(s.assignments)) {
    seatOf[guestId] = seat;
  }
  for (const c of s.constraints) {
    const sa = seatOf[c.a];
    const sb = seatOf[c.b];
    if (!sa || !sb) continue;
    const sameTable = parseSeatKey(sa).tableId === parseSeatKey(sb).tableId;
    const violated =
      c.kind === "must-sit-with" ? !sameTable : sameTable;
    if (violated) n++;
  }
  return n;
};

// Re-export for convenience.
export type { Constraint };
