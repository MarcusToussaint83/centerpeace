"use client";

import * as React from "react";
import type Konva from "konva";
import { Stage, Layer, Circle, Group, Line, Text } from "react-konva";

import { useShallow } from "zustand/react/shallow";

import {
  useEventStore,
  selectGuestForSeat,
  selectTableOccupancy,
  selectEvaluatedConstraints,
  selectViolatedSeatKeys,
} from "@/lib/store";
import { seatKey, parseSeatKey, type CenterpeaceTable } from "@/lib/types";

const TABLE_RADIUS = 70;
const SEAT_RADIUS = 16;
const SEAT_DISTANCE = TABLE_RADIUS + 26;

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

/**
 * Compute the absolute (canvas-world) position of a seat given its table.
 * Mirrors the geometry in SeatNode so the line endpoints land on seat centers.
 */
function seatWorldPosition(
  table: CenterpeaceTable,
  index: number,
): { x: number; y: number } {
  const angle = (index / table.capacity) * Math.PI * 2 - Math.PI / 2;
  return {
    x: table.x + Math.cos(angle) * SEAT_DISTANCE,
    y: table.y + Math.sin(angle) * SEAT_DISTANCE,
  };
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
        const pa = seatWorldPosition(tableA, a.index);
        const pb = seatWorldPosition(tableB, b.index);
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
      {/* Tabletop */}
      <Circle
        radius={TABLE_RADIUS}
        fill="#fbf6ec"
        stroke={isSelected ? "#3a4290" : "#d6cdb8"}
        strokeWidth={isSelected ? 3 : 1.5}
        shadowColor="#1a1d2b"
        shadowBlur={isSelected ? 18 : 10}
        shadowOpacity={isSelected ? 0.18 : 0.08}
        shadowOffsetY={4}
      />

      {/* Label */}
      <Text
        text={table.label}
        fontSize={13}
        fontStyle="600"
        fill="#2d2a24"
        align="center"
        width={TABLE_RADIUS * 2}
        offsetX={TABLE_RADIUS}
        offsetY={6}
      />
      <Text
        text={`${occupancy.seated}/${occupancy.capacity}`}
        fontSize={11}
        fill="#7a7468"
        align="center"
        width={TABLE_RADIUS * 2}
        offsetX={TABLE_RADIUS}
        offsetY={-10}
      />

      {/* Seats */}
      {Array.from({ length: table.capacity }).map((_, i) => (
        <SeatNode key={i} table={table} index={i} />
      ))}
    </Group>
  );
}

function SeatNode({ table, index }: { table: CenterpeaceTable; index: number }) {
  const angle = (index / table.capacity) * Math.PI * 2 - Math.PI / 2;
  const x = Math.cos(angle) * SEAT_DISTANCE;
  const y = Math.sin(angle) * SEAT_DISTANCE;
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
  const pickedGuest = guests.find((g) => g.id === pickedGuestId);

  return (
    <>
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
