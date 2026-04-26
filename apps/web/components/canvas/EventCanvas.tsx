"use client";

import * as React from "react";
import type Konva from "konva";
import { Stage, Layer, Circle, Group, Line, Rect, Text } from "react-konva";

import { useShallow } from "zustand/react/shallow";

import {
  useEventStore,
  selectGuestForSeat,
  selectTableOccupancy,
  evaluateConstraints,
} from "@/lib/store";
import { seatKey, parseSeatKey, type CenterpeaceTable } from "@/lib/types";
import {
  worldSeatPosition,
  localSeatPosition,
  tableBounds,
  findNearestSeat,
} from "@/lib/table-geometry";
import { TableInspector } from "@/components/panels/TableInspector";
import { exportPNG, exportCSV } from "@/lib/export";
import { workspaceClient, subscribeWorkspace } from "@/lib/workspace/client";
import type { AgentResponse } from "@/lib/workspace/validate";
import { validateReferences } from "@/lib/workspace/validate";

const SEAT_RADIUS = 16;

export function EventCanvas() {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<Konva.Stage>(null);

  const [size, setSize] = React.useState({ width: 800, height: 600 });
  const camera = useEventStore((s) => s.camera);
  const setCamera = useEventStore((s) => s.setCamera);
  const tables = useEventStore((s) => s.tables);

  // Resize observer
  React.useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]!.contentRect;
      setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Center camera on first mount (so x=0,y=0 is the middle of the canvas).
  const offsetX = size.width / 2 + camera.x;
  const offsetY = size.height / 2 + camera.y;

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = camera.scale;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.06;
    const newScale = clamp(
      direction > 0 ? oldScale * factor : oldScale / factor,
      0.3,
      2.5,
    );

    // Zoom toward cursor: keep the world point under the cursor stationary.
    const worldX = (pointer.x - offsetX) / oldScale;
    const worldY = (pointer.y - offsetY) / oldScale;
    const newOffsetX = pointer.x - worldX * newScale;
    const newOffsetY = pointer.y - worldY * newScale;

    setCamera({
      scale: newScale,
      x: newOffsetX - size.width / 2,
      y: newOffsetY - size.height / 2,
    });
  };

  // Background drag = pan.
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      dragStart.current = { x: e.evt.clientX, y: e.evt.clientY };
      useEventStore.getState().selectTable(null);
    }
  };
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!dragStart.current) return;
    const dx = e.evt.clientX - dragStart.current.x;
    const dy = e.evt.clientY - dragStart.current.y;
    dragStart.current = { x: e.evt.clientX, y: e.evt.clientY };
    setCamera({ x: camera.x + dx, y: camera.y + dy });
  };
  const endDrag = () => {
    dragStart.current = null;
  };

  // HTML5 DnD: accept guest drops anywhere on the canvas, hit-test to the
  // nearest seat in world space.
  const placeAtSeat = useEventStore((s) => s.placeAtSeat);
  const pickGuest = useEventStore((s) => s.pickGuest);
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("application/x-centerpeace-guest")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const guestId = e.dataTransfer.getData("application/x-centerpeace-guest");
    if (!guestId) return;
    e.preventDefault();

    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    // Reverse of Stage offset math in render (offset = size/2 + camera + world*scale).
    const worldX = (localX - offsetX) / camera.scale;
    const worldY = (localY - offsetY) / camera.scale;

    // Nearest seat within a threshold. 32 world-units matches visual seat size.
    const nearest = findNearestSeat(
      useEventStore.getState().tables,
      worldX,
      worldY,
      32,
    );
    // Ensure the store has the correct pickedGuestId, then place.
    pickGuest(guestId);
    if (nearest) {
      placeAtSeat(nearest);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={offsetX}
        y={offsetY}
        scaleX={camera.scale}
        scaleY={camera.scale}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{ cursor: dragStart.current ? "grabbing" : "default" }}
      >
        <Layer listening={false}>
          <ConstraintLines />
        </Layer>
        <Layer>
          {tables.map((table) => (
            <TableNode key={table.id} table={table} />
          ))}
        </Layer>
      </Stage>
      <CanvasOverlays stageRef={stageRef} />
    </div>
  );
}

function ConstraintLines() {
  const tables = useEventStore((s) => s.tables);
  const constraints = useEventStore((s) => s.constraints);
  const assignments = useEventStore((s) => s.assignments);
  const evaluated = React.useMemo(
    () => evaluateConstraints(constraints, assignments),
    [constraints, assignments],
  );

  // Render order: violations on top of satisfied positives.
  const drawables = React.useMemo(() => {
    return evaluated
      .filter((c) => c.seatA && c.seatB)
      .map((c) => {
        const a = parseSeatKey(c.seatA!);
        const b = parseSeatKey(c.seatB!);
        const tableA = tables.find((t) => t.id === a.tableId);
        const tableB = tables.find((t) => t.id === b.tableId);
        if (!tableA || !tableB) return null;
        const pa = worldSeatPosition(tableA, a.index);
        const pb = worldSeatPosition(tableB, b.index);
        return { c, pa, pb };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((x, y) => {
        // satisfied < violated, so violated draws last.
        const order = { satisfied: 0, pending: 1, violated: 2 } as const;
        return order[x.c.status] - order[y.c.status];
      });
  }, [evaluated, tables]);

  return (
    <>
      {drawables.map(({ c, pa, pb }) => {
        const violated = c.status === "violated";
        const satisfied = c.status === "satisfied";
        const isPositive = c.kind === "must-sit-with";

        // Color logic:
        //   violated must-sit-with    -> amber (need to fix; pull together)
        //   violated must-not-sit-with -> red    (urgent: pull apart)
        //   satisfied positive         -> faint green (reassuring)
        //   satisfied negative         -> no line (clean)
        if (satisfied && !isPositive) return null;

        const stroke = violated
          ? isPositive
            ? "#d97706" // amber-600
            : "#dc2626" // red-600
          : "#16a34a"; // green-600 for satisfied positive

        const opacity = satisfied ? 0.35 : 0.85;
        const dash = violated && !isPositive ? [10, 6] : undefined;

        return (
          <Line
            key={c.id}
            points={[pa.x, pa.y, pb.x, pb.y]}
            stroke={stroke}
            strokeWidth={violated ? 2.5 : 1.5}
            opacity={opacity}
            dash={dash}
            lineCap="round"
          />
        );
      })}
    </>
  );
}

function TableNode({ table }: { table: CenterpeaceTable }) {
  const selectedTableId = useEventStore((s) => s.selectedTableId);
  const selectTable = useEventStore((s) => s.selectTable);
  const moveTable = useEventStore((s) => s.moveTable);
  const occupancy = useEventStore(useShallow(selectTableOccupancy(table.id)));
  const constraints = useEventStore((s) => s.constraints);
  const assignments = useEventStore((s) => s.assignments);
  const violatedSeats = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of evaluateConstraints(constraints, assignments)) {
      if (c.status === "violated") {
        if (c.seatA) set.add(c.seatA);
        if (c.seatB) set.add(c.seatB);
      }
    }
    return set;
  }, [constraints, assignments]);

  const isSelected = selectedTableId === table.id;
  const bounds = tableBounds(table);

  // Width used to lay out label text horizontally (rect uses long axis).
  const labelWidth =
    bounds.shape.kind === "round"
      ? bounds.shape.radius * 2
      : bounds.shape.length;

  return (
    <Group
      x={table.x}
      y={table.y}
      draggable
      onDragStart={() => selectTable(table.id)}
      onDragEnd={(e) => moveTable(table.id, e.target.x(), e.target.y())}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        selectTable(table.id);
      }}
    >
      {/* Tabletop — rotates with table; label and seats also rotate together. */}
      <Group rotation={(table.rotation * 180) / Math.PI}>
        {bounds.shape.kind === "round" ? (
          <Circle
            radius={bounds.shape.radius}
            fill="#fbf6ec"
            stroke={isSelected ? "#3a4290" : "#d6cdb8"}
            strokeWidth={isSelected ? 3 : 1.5}
            shadowColor="#1a1d2b"
            shadowBlur={isSelected ? 18 : 10}
            shadowOpacity={isSelected ? 0.18 : 0.08}
            shadowOffsetY={4}
          />
        ) : (
          <Rect
            x={-bounds.shape.length / 2}
            y={-bounds.shape.width / 2}
            width={bounds.shape.length}
            height={bounds.shape.width}
            cornerRadius={10}
            fill="#fbf6ec"
            stroke={isSelected ? "#3a4290" : "#d6cdb8"}
            strokeWidth={isSelected ? 3 : 1.5}
            shadowColor="#1a1d2b"
            shadowBlur={isSelected ? 18 : 10}
            shadowOpacity={isSelected ? 0.18 : 0.08}
            shadowOffsetY={4}
          />
        )}

        <Text
          text={table.label}
          fontSize={13}
          fontStyle="600"
          fill="#2d2a24"
          align="center"
          width={labelWidth}
          offsetX={labelWidth / 2}
          offsetY={6}
        />
        <Text
          text={`${occupancy.seated}/${occupancy.capacity}`}
          fontSize={11}
          fill="#7a7468"
          align="center"
          width={labelWidth}
          offsetX={labelWidth / 2}
          offsetY={-10}
        />

        {Array.from({ length: table.capacity }).map((_, i) => (
          <SeatNode
            key={i}
            table={table}
            index={i}
            violatedSeats={violatedSeats}
          />
        ))}
      </Group>
    </Group>
  );
}

function SeatNode({
  table,
  index,
  violatedSeats,
}: {
  table: CenterpeaceTable;
  index: number;
  violatedSeats: Set<string>;
}) {
  const { x, y } = localSeatPosition(table, index);
  const key = seatKey(table.id, index);

  const guest = useEventStore(selectGuestForSeat(key));
  const pickedGuestId = useEventStore((s) => s.pickedGuestId);
  const placeAtSeat = useEventStore((s) => s.placeAtSeat);
  const clearSeat = useEventStore((s) => s.clearSeat);
  const pickGuest = useEventStore((s) => s.pickGuest);
  const isViolating = violatedSeats.has(key);

  const occupied = !!guest;
  const isPickedHere = pickedGuestId && guest?.id === pickedGuestId;
  const isDropTarget = !!pickedGuestId && !occupied;

  const fill = isPickedHere
    ? "#3a4290"
    : occupied
      ? "#e6dfca"
      : isDropTarget
        ? "#dee0f3"
        : "#f7f2e3";
  const stroke = isViolating
    ? "#dc2626" // red-600
    : isPickedHere
      ? "#1f244f"
      : isDropTarget
        ? "#3a4290"
        : "#cfc6ae";

  return (
    <Group
      x={x}
      y={y}
      onMouseDown={(e) => {
        e.cancelBubble = true;
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        if (occupied && !pickedGuestId) {
          // Pick up the seated guest (allows re-placing).
          pickGuest(guest!.id);
        } else if (occupied && pickedGuestId === guest!.id) {
          // Click again to unseat.
          clearSeat(key);
          pickGuest(null);
        } else if (pickedGuestId) {
          placeAtSeat(key);
        } else {
          // No-op on empty seat with nothing picked.
        }
      }}
    >
      <Circle
        radius={SEAT_RADIUS}
        fill={fill}
        stroke={stroke}
        strokeWidth={isViolating ? 2.5 : isDropTarget ? 2 : 1}
        shadowColor={isViolating ? "#dc2626" : "#1a1d2b"}
        shadowBlur={isViolating ? 10 : isDropTarget ? 8 : 0}
        shadowOpacity={isViolating ? 0.4 : isDropTarget ? 0.2 : 0}
      />
      {guest && (
        <Text
          text={initialsOf(guest.name)}
          fontSize={9}
          fontStyle="600"
          fill={isPickedHere ? "#fbf6ec" : "#2d2a24"}
          align="center"
          verticalAlign="middle"
          width={SEAT_RADIUS * 2}
          height={SEAT_RADIUS * 2}
          offsetX={SEAT_RADIUS}
          offsetY={SEAT_RADIUS}
          listening={false}
        />
      )}
    </Group>
  );
}

function CanvasOverlays({ stageRef }: { stageRef: React.RefObject<Konva.Stage | null> }) {
  const camera = useEventStore((s) => s.camera);
  const setCamera = useEventStore((s) => s.setCamera);
  const reset = useEventStore((s) => s.reset);
  const pickedGuestId = useEventStore((s) => s.pickedGuestId);
  const guests = useEventStore((s) => s.guests);
  const addTable = useEventStore((s) => s.addTable);
  const autoSeat = useEventStore((s) => s.autoSeat);
  const reseatAll = useEventStore((s) => s.reseatAll);
  const versions = useEventStore((s) => s.versions);
  const saveVersion = useEventStore((s) => s.saveVersion);
  const restoreVersion = useEventStore((s) => s.restoreVersion);
  const deleteVersion = useEventStore((s) => s.deleteVersion);
  const workspacePath = useEventStore((s) => s.workspacePath);
  const lastSyncAt = useEventStore((s) => s.lastSyncAt);
  const setWorkspacePath = useEventStore((s) => s.setWorkspacePath);
  const markSynced = useEventStore((s) => s.markSynced);
  const eventState = useEventStore(
    useShallow((s) => ({
      name: s.name,
      guests: s.guests,
      tables: s.tables,
      assignments: s.assignments,
    })),
  );
  // Subset used to drive auto-sync; includes id + constraints so the
  // workspace gets a complete picture of the event.
  const syncableState = useEventStore(
    useShallow((s) => ({
      id: s.id,
      name: s.name,
      guests: s.guests,
      tables: s.tables,
      assignments: s.assignments,
      constraints: s.constraints,
    })),
  );
  const setAssignments = useEventStore((s) => s.setAssignments);
  const applyPlacements = useEventStore((s) => s.applyPlacements);
  const saveVersionFn = useEventStore((s) => s.saveVersion);
  const constraintsForRef = useEventStore((s) => s.constraints);
  const pickedGuest = guests.find((g) => g.id === pickedGuestId);

  // Toast surfaces the auto-seater's summary for a few seconds.
  const [toast, setToast] = React.useState<{
    title: string;
    placed: number;
    unplaced: number;
    summary: string[];
    undo?: () => void;
  } | null>(null);

  // ---- Agent proposal subscription ----
  // When a workspace is configured, subscribe to its SSE stream and queue
  // any validated proposals for the user to accept / reject. Multiple
  // proposals queue up; we show one at a time.
  const [proposals, setProposals] = React.useState<
    { file: string; response: AgentResponse }[]
  >([]);
  const [proposalIssues, setProposalIssues] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (!workspacePath) return;
    const unsubscribe = subscribeWorkspace(workspacePath, {
      onProposal: (ev) => setProposals((q) => [...q, ev]),
      onInvalid: (ev) =>
        setToast({
          title: `Invalid response in ${ev.file.split("/").pop()}`,
          placed: 0,
          unplaced: 0,
          summary: ev.errors.slice(0, 4),
        }),
      onError: (e) => console.warn("workspace SSE error", e),
    });
    return unsubscribe;
  }, [workspacePath]);

  const currentProposal = proposals[0] ?? null;
  // Re-validate references against the live state every render so the issues
  // shown stay in sync if the user edits the chart while a proposal is open.
  React.useEffect(() => {
    if (!currentProposal) {
      setProposalIssues([]);
      return;
    }
    setProposalIssues(
      validateReferences(currentProposal.response, {
        guests,
        tables: useEventStore.getState().tables,
        assignments: useEventStore.getState().assignments,
        constraints: constraintsForRef,
      }),
    );
  }, [currentProposal, guests, constraintsForRef]);

  const acceptProposal = async () => {
    if (!currentProposal || !workspacePath) return;
    const moves = currentProposal.response.proposedAssignments ?? [];
    if (moves.length > 0) {
      saveVersionFn(`Before agent: ${currentProposal.response.summary.slice(0, 40)}`);
      const placements: Record<string, string> = {};
      for (const m of moves) {
        placements[`${m.tableId}:${m.seatIndex}`] = m.guestId;
      }
      applyPlacements(placements);
    }
    try {
      await workspaceClient.acceptResponse({
        path: workspacePath,
        file: currentProposal.file,
        requestId: currentProposal.response.requestId,
        requestType: currentProposal.response.type,
        summary: currentProposal.response.summary,
      });
    } catch (e) {
      console.warn("accept-response archive failed", e);
    }
    setProposals((q) => q.slice(1));
  };

  const rejectProposal = async () => {
    if (!currentProposal || !workspacePath) return;
    try {
      await workspaceClient.rejectResponse({
        path: workspacePath,
        file: currentProposal.file,
        requestId: currentProposal.response.requestId,
        requestType: currentProposal.response.type,
        summary: currentProposal.response.summary,
      });
    } catch (e) {
      console.warn("reject-response archive failed", e);
    }
    setProposals((q) => q.slice(1));
  };
  React.useEffect(() => {
    if (!toast) return;
    // Reseat toasts stick longer because the user might want to undo.
    const dur = toast.undo ? 10000 : 6000;
    const t = setTimeout(() => setToast(null), dur);
    return () => clearTimeout(t);
  }, [toast]);

  const runAutoSeat = () => {
    const result = autoSeat();
    setToast({
      title: "Auto-seated unplaced guests",
      placed: Object.keys(result.placements).length,
      unplaced: result.unplaced.length,
      summary: result.summary,
    });
  };

  const runReseatAll = () => {
    if (
      !confirm(
        "Reseat everyone from scratch? Existing seat assignments will be replaced. You can undo from the toast.",
      )
    ) {
      return;
    }
    const result = reseatAll();
    const snapshot = result.previousAssignments;
    setToast({
      title: "Reseated everyone from scratch",
      placed: Object.keys(result.placements).length,
      unplaced: result.unplaced.length,
      summary: result.summary,
      undo: () => {
        setAssignments(snapshot);
        setToast(null);
      },
    });
  };

  return (
    <>
      <TableInspector />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-between p-4 text-xs text-muted-foreground">
        <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-card/90 p-1 shadow-sm backdrop-blur">
          <button
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary"
            onClick={() =>
              setCamera({ scale: clamp(camera.scale / 1.15, 0.3, 2.5) })
            }
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="min-w-[3ch] text-center font-mono">
            {Math.round(camera.scale * 100)}%
          </span>
          <button
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary"
            onClick={() =>
              setCamera({ scale: clamp(camera.scale * 1.15, 0.3, 2.5) })
            }
            aria-label="Zoom in"
          >
            +
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            className="rounded px-2 py-1 hover:bg-secondary"
            onClick={() => setCamera({ x: 0, y: 0, scale: 1 })}
          >
            Reset view
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            className="rounded px-2 py-1 font-medium text-primary hover:bg-primary/10"
            onClick={runAutoSeat}
            title="Place all unseated guests respecting must-sit-with / must-not-sit-with"
          >
            ✨ Auto-seat
          </button>
          <button
            className="rounded px-2 py-1 font-medium text-primary hover:bg-primary/10"
            onClick={runReseatAll}
            title="Clear all assignments and reseat from scratch"
          >
            ↻ Reseat all
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <HistoryMenu
            versions={versions}
            saveVersion={saveVersion}
            restoreVersion={restoreVersion}
            deleteVersion={deleteVersion}
          />
          <WorkspaceMenu
            workspacePath={workspacePath}
            lastSyncAt={lastSyncAt}
            eventName={eventState.name}
            state={syncableState}
            setWorkspacePath={setWorkspacePath}
            markSynced={markSynced}
          />
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            className="rounded px-2 py-1 font-medium hover:bg-secondary"
            onClick={() => {
              // World point under the viewport center, with a small jitter so
              // repeated clicks don't pile tables on top of each other.
              const cx = -camera.x / camera.scale;
              const cy = -camera.y / camera.scale;
              const jitter = () => (Math.random() - 0.5) * 80;
              addTable({ x: cx + jitter(), y: cy + jitter() });
            }}
          >
            + Table
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            className="rounded px-2 py-1 font-medium hover:bg-secondary"
            onClick={() => {
              if (stageRef.current) exportPNG(stageRef.current, eventState.name);
            }}
            title="Download seating chart as PNG"
          >
            ↓ PNG
          </button>
          <button
            className="rounded px-2 py-1 font-medium hover:bg-secondary"
            onClick={() => exportCSV(eventState)}
            title="Download guest list as CSV"
          >
            ↓ CSV
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            className="rounded px-2 py-1 text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (confirm("Reset the demo event? All seating will be cleared.")) {
                reset();
              }
            }}
          >
            Reset event
          </button>
        </div>
        <div className="pointer-events-none rounded-md bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur">
          Drag empty space to pan · Scroll to zoom · Drag tables to rearrange
        </div>
      </div>

      {pickedGuest && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-lg">
          Placing <span className="font-semibold">{pickedGuest.name}</span> ·
          click a seat
        </div>
      )}

      {currentProposal && (
        <ProposalCard
          proposal={currentProposal.response}
          issues={proposalIssues}
          queueSize={proposals.length}
          onAccept={acceptProposal}
          onReject={rejectProposal}
        />
      )}

      {toast && (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 max-w-md -translate-x-1/2 rounded-lg border border-border bg-card/95 px-4 py-3 text-xs shadow-lg backdrop-blur">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-semibold">
              {toast.title}
              {toast.placed > 0 && (
                <span className="ml-2 text-muted-foreground">
                  · {toast.placed} placed
                </span>
              )}
              {toast.unplaced > 0 && (
                <span className="ml-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                  {toast.unplaced} unplaced
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {toast.undo && (
                <button
                  onClick={toast.undo}
                  className="rounded-md border border-input bg-background px-2 py-0.5 text-[11px] font-medium hover:bg-secondary"
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => setToast(null)}
                className="rounded p-0.5 text-muted-foreground hover:bg-secondary"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto text-muted-foreground">
            {toast.summary.slice(0, 8).map((line, i) => (
              <li key={i} className="leading-snug">
                {line}
              </li>
            ))}
            {toast.summary.length > 8 && (
              <li className="italic">
                …and {toast.summary.length - 8} more
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}

function initialsOf(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ProposalCard({
  proposal,
  issues,
  queueSize,
  onAccept,
  onReject,
}: {
  proposal: AgentResponse;
  issues: string[];
  queueSize: number;
  onAccept: () => void;
  onReject: () => void;
}) {
  const moves = proposal.proposedAssignments ?? [];
  const warnings = proposal.warnings ?? [];

  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 w-[min(640px,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-primary/40 bg-card/95 text-xs shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-border bg-primary/10 px-4 py-2">
        <div className="flex items-center gap-2 font-semibold">
          <span>✨ Agent proposal</span>
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-wider">
            {proposal.type}
          </span>
          {proposal.agent && (
            <span className="text-[10px] text-muted-foreground">
              · {proposal.agent}
            </span>
          )}
          {queueSize > 1 && (
            <span className="text-[10px] text-muted-foreground">
              · {queueSize - 1} more queued
            </span>
          )}
        </div>
        <button
          onClick={onReject}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Reject"
          title="Reject"
        >
          ×
        </button>
      </div>
      <div className="max-h-[40vh] overflow-y-auto px-4 py-3">
        <p className="font-medium leading-snug">{proposal.summary}</p>
        {proposal.explanation && (
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {proposal.explanation}
          </p>
        )}
        {moves.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {moves.length} proposed move{moves.length === 1 ? "" : "s"}
            </div>
            <ul className="space-y-1.5">
              {moves.slice(0, 6).map((m, i) => (
                <li key={i} className="rounded border border-border/60 bg-background/50 px-2 py-1.5">
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {m.guestId} → {m.tableId} · seat {m.seatIndex + 1}
                  </div>
                  <div className="mt-0.5">{m.reasoning}</div>
                </li>
              ))}
              {moves.length > 6 && (
                <li className="text-[10px] text-muted-foreground">
                  + {moves.length - 6} more (review in workspace if needed)
                </li>
              )}
            </ul>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Agent warnings
            </div>
            <ul className="space-y-0.5 text-amber-700 dark:text-amber-300">
              {warnings.map((w, i) => (
                <li key={i}>· {w.message}</li>
              ))}
            </ul>
          </div>
        )}
        {issues.length > 0 && (
          <div className="mt-3 rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-destructive">
            <div className="text-[10px] font-semibold uppercase tracking-wider">
              Reference mismatches — accepting may produce unexpected results
            </div>
            <ul className="mt-0.5 space-y-0.5">
              {issues.slice(0, 4).map((iss, i) => (
                <li key={i}>· {iss}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/40 px-4 py-2">
        <button
          onClick={onReject}
          className="rounded border border-input bg-background px-3 py-1 font-medium hover:bg-secondary"
        >
          Reject
        </button>
        <button
          onClick={onAccept}
          className="rounded bg-primary px-3 py-1 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Accept{moves.length > 0 ? ` · ${moves.length} move${moves.length === 1 ? "" : "s"}` : ""}
        </button>
      </div>
    </div>
  );
}

function WorkspaceMenu({
  workspacePath,
  lastSyncAt,
  eventName,
  state,
  setWorkspacePath,
  markSynced,
}: {
  workspacePath: string | null;
  lastSyncAt: string | null;
  eventName: string;
  state: {
    id: string;
    name: string;
    guests: import("@/lib/types").Guest[];
    tables: import("@/lib/types").CenterpeaceTable[];
    assignments: import("@/lib/types").SeatAssignments;
    constraints: import("@/lib/types").Constraint[];
  };
  setWorkspacePath: (p: string | null) => void;
  markSynced: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [generateMode, setGenerateMode] = React.useState(false);
  const [requestType, setRequestType] = React.useState<
    "suggest-arrangement" | "review-table" | "find-conflicts" | "explain-arrangement"
  >("suggest-arrangement");
  const [requestNote, setRequestNote] = React.useState("");
  const [generated, setGenerated] = React.useState<string | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // Auto-sync: 1s debounce on every state change while a workspace is set.
  // Any sync failure clears the path silently — most likely cause is a
  // deployed (non-fs) environment or the user deleted the folder.
  const syncRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!workspacePath) return;
    if (syncRef.current) window.clearTimeout(syncRef.current);
    syncRef.current = window.setTimeout(async () => {
      try {
        await workspaceClient.sync(workspacePath, state as unknown as Record<string, unknown>);
        markSynced();
      } catch (e) {
        console.warn("workspace sync failed", e);
      }
    }, 1000);
    return () => {
      if (syncRef.current) window.clearTimeout(syncRef.current);
    };
  }, [workspacePath, state, markSynced]);

  const setUp = async () => {
    setError(null);
    setBusy("Setting up…");
    try {
      const { path } = await workspaceClient.defaultPath(eventName);
      const ok = confirm(
        `Create your agent workspace at:\n\n${path}\n\n` +
          `Your guest list and seating data will be written to disk in plain text. ` +
          `OK to continue?`,
      );
      if (!ok) {
        setBusy(null);
        return;
      }
      const result = await workspaceClient.bootstrap(path);
      setWorkspacePath(result.root);
      // Immediate first sync so the workspace is usable right away.
      await workspaceClient.sync(result.root, state as unknown as Record<string, unknown>);
      markSynced();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    if (!workspacePath) return;
    setError(null);
    setBusy("Syncing…");
    try {
      await workspaceClient.sync(workspacePath, state as unknown as Record<string, unknown>);
      markSynced();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (!workspacePath) return;
    setError(null);
    setBusy("Writing request…");
    try {
      // Sync first so the agent reads the freshest state.
      await workspaceClient.sync(workspacePath, state as unknown as Record<string, unknown>);
      markSynced();
      const result = await workspaceClient.createRequest({
        path: workspacePath,
        type: requestType,
        note: requestNote || undefined,
      });
      setGenerated(result.filename);
      setRequestNote("");
      setGenerateMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const clearWs = async () => {
    if (!workspacePath) return;
    if (!confirm("Clear the workspace folder? Files in archive/ are kept.")) return;
    setBusy("Clearing…");
    try {
      await workspaceClient.clear(workspacePath);
      setWorkspacePath(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  // Truncate path for display.
  const shortPath = workspacePath
    ? workspacePath.replace(/^.+?(\/[^/]+\/[^/]+)$/, "…$1")
    : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        className="rounded px-2 py-1 font-medium hover:bg-secondary"
        onClick={() => (workspacePath ? setOpen((v) => !v) : setUp())}
        title={workspacePath ? `Workspace: ${workspacePath}` : "Set up agent workspace"}
        disabled={busy !== null}
      >
        {workspacePath ? `⌂ Workspace${lastSyncAt ? " ✓" : ""}` : "⌂ Workspace"}
      </button>
      {open && workspacePath && (
        <div
          className="absolute bottom-full left-0 mb-2 w-80 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
          role="menu"
        >
          <div className="border-b border-border px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Workspace
            </div>
            <div
              className="mt-0.5 truncate font-mono text-[11px]"
              title={workspacePath}
            >
              {shortPath}
            </div>
            {lastSyncAt && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Last sync · {new Date(lastSyncAt).toLocaleTimeString()}
              </div>
            )}
          </div>
          {generated && (
            <div className="border-b border-border bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-400">
              Wrote <code className="font-mono">requests/{generated}</code>.
              Run your agent in the workspace folder to process it.
            </div>
          )}
          {generateMode ? (
            <div className="border-b border-border px-3 py-2 text-xs">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Request type
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as typeof requestType)}
                className="mb-2 block w-full rounded border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="suggest-arrangement">Suggest arrangement</option>
                <option value="review-table">Review a table</option>
                <option value="find-conflicts">Find conflicts</option>
                <option value="explain-arrangement">Explain arrangement</option>
              </select>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Note for the agent (optional)
              </label>
              <textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                rows={3}
                placeholder="e.g. focus on Table 12, that's our legacy giving conversation."
                className="mb-2 block w-full resize-none rounded border border-input bg-background px-2 py-1 text-xs"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setGenerateMode(false)}
                  className="rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={generate}
                  disabled={busy !== null}
                  className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ?? "Generate request"}
                </button>
              </div>
            </div>
          ) : null}
          <ul className="text-xs">
            {!generateMode && (
              <li>
                <button
                  onClick={() => {
                    setGenerated(null);
                    setGenerateMode(true);
                  }}
                  disabled={busy !== null}
                  className="block w-full px-3 py-2 text-left font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  + Generate request…
                </button>
              </li>
            )}
            <li>
              <button
                onClick={syncNow}
                disabled={busy !== null}
                className="block w-full px-3 py-2 text-left hover:bg-secondary/60 disabled:opacity-50"
              >
                Sync now
              </button>
            </li>
            <li>
              <button
                onClick={clearWs}
                disabled={busy !== null}
                className="block w-full px-3 py-2 text-left text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                Clear workspace
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setWorkspacePath(null);
                  setOpen(false);
                }}
                className="block w-full border-t border-border px-3 py-2 text-left text-muted-foreground hover:bg-secondary/60"
              >
                Disconnect (keep files on disk)
              </button>
            </li>
          </ul>
          {error && (
            <div className="border-t border-border bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryMenu({
  versions,
  saveVersion,
  restoreVersion,
  deleteVersion,
}: {
  versions: import("@/lib/store").VersionSnapshot[];
  saveVersion: (label?: string) => string;
  restoreVersion: (id: string) => void;
  deleteVersion: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // Click-outside to close.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const onSave = () => {
    const label = prompt("Label this version (optional):", "");
    if (label === null) return;
    saveVersion(label || undefined);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        className="rounded px-2 py-1 font-medium hover:bg-secondary"
        onClick={() => setOpen((v) => !v)}
        title="Saved versions"
      >
        ⧗ History{versions.length > 0 ? ` · ${versions.length}` : ""}
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Versions
            </span>
            <button
              onClick={onSave}
              className="rounded border border-input bg-background px-2 py-0.5 text-[11px] font-medium hover:bg-secondary"
            >
              + Save current
            </button>
          </div>
          {versions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No saved versions yet. Save one to snapshot this arrangement.
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="group flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2 text-xs last:border-b-0 hover:bg-secondary/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{v.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100">
                    <button
                      onClick={() => {
                        if (confirm(`Restore "${v.label}"? Current arrangement will be replaced.`)) {
                          restoreVersion(v.id);
                          setOpen(false);
                        }
                      }}
                      className="rounded border border-input bg-background px-1.5 py-0.5 text-[10px] font-medium hover:bg-secondary"
                      title="Restore this version"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${v.label}"?`)) deleteVersion(v.id);
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Delete this version"
                      aria-label="Delete version"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
