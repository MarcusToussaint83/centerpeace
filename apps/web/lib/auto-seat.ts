/**
 * Deterministic auto-seater.
 *
 * Doesn't try to be optimal — it tries to be useful and predictable. The job:
 *
 *   1. Don't disturb anyone who's already seated.
 *   2. Respect `must-sit-with`: keep groups of constrained guests at the same
 *      table, including pulling unseated members to a table where one of them
 *      is already seated.
 *   3. Respect `must-not-sit-with`: never place someone at a table that would
 *      put them across from an enemy.
 *   4. Place everyone you can; report who you couldn't and why.
 *
 * This deliberately doesn't model "preferred near" / centerpieces / VIP
 * weighting yet. Once the constraint vocabulary grows, this becomes the
 * placement-policy function the eventual solver / LLM strategy calls into.
 */

import type {
  Constraint,
  EventState,
  GuestId,
  SeatAssignments,
  SeatKey,
  CenterpeaceTable,
} from "./types";
import { parseSeatKey, seatKey } from "./types";

export interface AutoSeatResult {
  placements: SeatAssignments; // new seat -> guest assignments to apply
  unplaced: Array<{ guestId: GuestId; reason: string }>;
  /** Human-readable summary lines for the result toast / console. */
  summary: string[];
}

/** Union-find over guest ids using the must-sit-with constraint edges. */
function buildClusters(
  guestIds: GuestId[],
  constraints: Constraint[],
): Map<GuestId, GuestId> {
  const parent = new Map<GuestId, GuestId>();
  for (const id of guestIds) parent.set(id, id);

  const find = (x: GuestId): GuestId => {
    let cur = x;
    while (parent.get(cur)! !== cur) cur = parent.get(cur)!;
    // Path compression
    let walker = x;
    while (parent.get(walker)! !== cur) {
      const next = parent.get(walker)!;
      parent.set(walker, cur);
      walker = next;
    }
    return cur;
  };

  const union = (a: GuestId, b: GuestId) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const c of constraints) {
    if (c.kind === "must-sit-with" && parent.has(c.a) && parent.has(c.b)) {
      union(c.a, c.b);
    }
  }

  return parent;
}

function tableOpenSeats(
  table: CenterpeaceTable,
  assignments: SeatAssignments,
): SeatKey[] {
  const out: SeatKey[] = [];
  for (let i = 0; i < table.capacity; i++) {
    const k = seatKey(table.id, i);
    if (!assignments[k]) out.push(k);
  }
  return out;
}

function guestsAtTable(
  tableId: string,
  assignments: SeatAssignments,
): Set<GuestId> {
  const out = new Set<GuestId>();
  for (const [seat, guestId] of Object.entries(assignments)) {
    if (parseSeatKey(seat).tableId === tableId) out.add(guestId);
  }
  return out;
}

/** Returns true if seating `guestId` at `tableId` would create a violation. */
function wouldViolate(
  guestId: GuestId,
  tableId: string,
  assignments: SeatAssignments,
  constraints: Constraint[],
): boolean {
  const enemies = new Set<GuestId>();
  for (const c of constraints) {
    if (c.kind !== "must-not-sit-with") continue;
    if (c.a === guestId) enemies.add(c.b);
    else if (c.b === guestId) enemies.add(c.a);
  }
  if (enemies.size === 0) return false;
  const guestsHere = guestsAtTable(tableId, assignments);
  for (const e of enemies) if (guestsHere.has(e)) return true;
  return false;
}

export function autoSeat(state: EventState): AutoSeatResult {
  const placements: SeatAssignments = {};
  const unplaced: Array<{ guestId: GuestId; reason: string }> = [];
  const summary: string[] = [];

  // Working copy of assignments so we can incrementally check capacity / enemies.
  const working: SeatAssignments = { ...state.assignments };

  // Already-seated guest ids
  const seated = new Set(Object.values(working));

  const allUnseated = state.guests.filter((g) => !seated.has(g.id));
  if (allUnseated.length === 0) {
    summary.push("Everyone is already seated. Nothing to do.");
    return { placements, unplaced, summary };
  }

  // Cluster all guests (seated + unseated) by must-sit-with so we can detect
  // when a group already has an anchor at a particular table.
  const parent = buildClusters(
    state.guests.map((g) => g.id),
    state.constraints,
  );
  const find = (x: GuestId): GuestId => {
    let cur = x;
    while (parent.get(cur)! !== cur) cur = parent.get(cur)!;
    return cur;
  };

  // Group unseated guests by cluster root.
  const clusters = new Map<GuestId, GuestId[]>();
  for (const g of allUnseated) {
    const root = find(g.id);
    const list = clusters.get(root) ?? [];
    list.push(g.id);
    clusters.set(root, list);
  }

  // For each cluster, find the table any member is already seated at.
  const anchorTable = new Map<GuestId, string>();
  for (const [seat, guestId] of Object.entries(working)) {
    anchorTable.set(find(guestId), parseSeatKey(seat).tableId);
  }

  // Order clusters: largest first, then those with an anchor first within size,
  // so the hardest groups get their pick of tables.
  const orderedClusters = [...clusters.entries()].sort((a, b) => {
    const sizeDiff = b[1].length - a[1].length;
    if (sizeDiff !== 0) return sizeDiff;
    const aAnchored = anchorTable.has(a[0]) ? 1 : 0;
    const bAnchored = anchorTable.has(b[0]) ? 1 : 0;
    return bAnchored - aAnchored;
  });

  const guestById = new Map(state.guests.map((g) => [g.id, g] as const));
  const nameOf = (id: GuestId) => guestById.get(id)?.name ?? id;

  for (const [root, members] of orderedClusters) {
    // Build the table priority list.
    const candidateTables = [...state.tables].sort((a, b) => {
      const anchor = anchorTable.get(root);
      const aIsAnchor = a.id === anchor ? 1 : 0;
      const bIsAnchor = b.id === anchor ? 1 : 0;
      if (aIsAnchor !== bIsAnchor) return bIsAnchor - aIsAnchor;
      // Then prefer tables with the most open seats.
      return (
        tableOpenSeats(b, working).length - tableOpenSeats(a, working).length
      );
    });

    let placedCluster = false;
    for (const table of candidateTables) {
      const open = tableOpenSeats(table, working);
      if (open.length < members.length) continue;
      // Check none of the members would violate must-not-sit-with at this table.
      const hasConflict = members.some((m) =>
        wouldViolate(m, table.id, working, state.constraints),
      );
      if (hasConflict) continue;
      // Seat them in the next open seats.
      for (let i = 0; i < members.length; i++) {
        const seat = open[i]!;
        working[seat] = members[i]!;
        placements[seat] = members[i]!;
      }
      placedCluster = true;
      if (members.length > 1) {
        summary.push(
          `Placed ${members.map(nameOf).join(" + ")} at ${table.label}`,
        );
      } else {
        summary.push(`Placed ${nameOf(members[0]!)} at ${table.label}`);
      }
      break;
    }

    if (!placedCluster) {
      const reason =
        members.length > 1
          ? `Could not find a table with ${members.length} adjacent open seats and no must-not conflicts`
          : `No open seat without a must-not conflict`;
      for (const m of members) unplaced.push({ guestId: m, reason });
      summary.push(
        `Could not place ${members.map(nameOf).join(" + ")} — ${reason.toLowerCase()}`,
      );
    }
  }

  return { placements, unplaced, summary };
}
