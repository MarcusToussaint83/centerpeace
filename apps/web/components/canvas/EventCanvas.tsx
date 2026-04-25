"use client";

import * as React from "react";
import type Konva from "konva";
import { Stage, Layer, Circle, Group, Line, Rect, Text } from "react-konva";

import { useShallow } from "zustand/react/shallow";

import {
  useEventStore,
  selectGuestForSeat,
  selectTableOccupancy,
  selectEvaluatedConstraints,
  selectViolatedSeatKeys,
} from "@/lib/store";
import { seatKey, parseSeatKey, type CenterpeaceTable } from "@/lib/types";
import {
  worldSeatPosition,
  localSeatPosition,
  tableBounds,
} from "@/lib/table-geometry";
import { TableInspector } from "@/components/panels/TableInspector";

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

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
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
      <CanvasOverlays />
    </div>
  );
}

function ConstraintLines() {
  const tables = useEventStore((s) => s.tables);
  const evaluated = useEventStore(useShallow(selectEvaluatedConstraints));

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
          <SeatNode key={i} table={table} index={i} />
        ))}
      </Group>
    </Group>
  );
}

function SeatNode({ table, index }: { table: CenterpeaceTable; index: number }) {
  const { x, y } = localSeatPosition(table, index);
  const key = seatKey(table.id, index);

  const guest = useEventStore(selectGuestForSeat(key));
  const pickedGuestId = useEventStore((s) => s.pickedGuestId);
  const placeAtSeat = useEventStore((s) => s.placeAtSeat);
  const clearSeat = useEventStore((s) => s.clearSeat);
  const pickGuest = useEventStore((s) => s.pickGuest);
  const violatedSeats = useEventStore(useShallow(selectViolatedSeatKeys));
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

function CanvasOverlays() {
  const camera = useEventStore((s) => s.camera);
  const setCamera = useEventStore((s) => s.setCamera);
  const reset = useEventStore((s) => s.reset);
  const pickedGuestId = useEventStore((s) => s.pickedGuestId);
  const guests = useEventStore((s) => s.guests);
  const addTable = useEventStore((s) => s.addTable);
  const autoSeat = useEventStore((s) => s.autoSeat);
  const pickedGuest = guests.find((g) => g.id === pickedGuestId);

  // Toast surfaces the auto-seater's summary for a few seconds.
  const [toast, setToast] = React.useState<{
    placed: number;
    unplaced: number;
    summary: string[];
  } | null>(null);
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const runAutoSeat = () => {
    const result = autoSeat();
    setToast({
      placed: Object.keys(result.placements).length,
      unplaced: result.unplaced.length,
      summary: result.summary,
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
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            className="rounded px-2 py-1 font-medium hover:bg-secondary"
            onClick={() =>
              addTable({
                // Drop new tables at the world origin so they're easy to find,
                // then let the user drag.
                x: -camera.x / camera.scale,
                y: -camera.y / camera.scale,
              })
            }
          >
            + Table
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

      {toast && (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 max-w-md -translate-x-1/2 rounded-lg border border-border bg-card/95 px-4 py-3 text-xs shadow-lg backdrop-blur">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-semibold">
              {toast.placed > 0
                ? `Auto-seated ${toast.placed} guest${toast.placed === 1 ? "" : "s"}`
                : "Nothing changed"}
              {toast.unplaced > 0 && (
                <span className="ml-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                  {toast.unplaced} unplaced
                </span>
              )}
            </span>
            <button
              onClick={() => setToast(null)}
              className="rounded p-0.5 text-muted-foreground hover:bg-secondary"
              aria-label="Dismiss"
            >
              ×
            </button>
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
