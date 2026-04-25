"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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

  addConstraint(input: { kind: ConstraintKind; a: GuestId; b: GuestId; note?: string }): void;
  removeConstraint(id: string): void;
}

export type Store = EventState & SelectionState & UIState & Actions;

const initialEvent = buildDemoEvent();

export const useEventStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialEvent,
      pickedGuestId: null,
      selectedTableId: null,
      camera: { x: 0, y: 0, scale: 1 },

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
      }),
      version: 2,
      migrate: (persistedState, version) => {
        const s = (persistedState ?? {}) as Partial<EventState>;
        if (version < 2 && !s.constraints) {
          // Earlier versions didn't track constraints; reseed from the demo so
          // existing users get the full picture without re-importing.
          const fresh = buildDemoEvent();
          s.constraints = fresh.constraints;
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
 * - `must-sit-with`:    pending if either guest unseated; satisfied if same
 *                        table; violated if seated at different tables.
 * - `must-not-sit-with`: pending if either guest unseated; violated if same
 *                        table; satisfied if seated at different tables.
 *
 * We surface seatA/seatB so the canvas can draw lines without re-deriving.
 */
export const selectEvaluatedConstraints = (s: Store): EvaluatedConstraint[] => {
  // Reverse-index: guestId -> seatKey
  const seatOf: Record<GuestId, SeatKey> = {};
  for (const [seat, guestId] of Object.entries(s.assignments)) {
    seatOf[guestId] = seat;
  }

  return s.constraints.map((c): EvaluatedConstraint => {
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
};

export const selectViolationCount = (s: Store): number =>
  selectEvaluatedConstraints(s).filter((c) => c.status === "violated").length;

/** Used as a hint on the canvas: which seat keys are involved in violations. */
export const selectViolatedSeatKeys = (s: Store): Set<SeatKey> => {
  const result = new Set<SeatKey>();
  for (const c of selectEvaluatedConstraints(s)) {
    if (c.status === "violated") {
      if (c.seatA) result.add(c.seatA);
      if (c.seatB) result.add(c.seatB);
    }
  }
  return result;
};

// Re-export for convenience.
export type { Constraint };
