/**
 * Validate + archive `proposed-changes/*.json` files.
 *
 * The agent drops a single JSON file in `proposed-changes/`. The watcher
 * parses it, validates it against the apply schema, and emits the parsed
 * payload to the client. The client mutates its store and then asks the
 * server to archive the file. There is no human review step in between.
 */

import fs from "node:fs/promises";
import path from "node:path";
import Ajv, { type ValidateFunction } from "ajv";
import { APPLY_SCHEMA } from "./templates";
import { workspacePaths } from "./paths";

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema: ValidateFunction = ajv.compile(APPLY_SCHEMA);

export interface ApplyPayload {
  specVersion: "1.0";
  agent?: string;
  note?: string;
  assignments?: Record<string, string>;
  removeAssignments?: string[];
  addConstraints?: Array<{
    kind: "must-sit-with" | "must-not-sit-with";
    guestAId: string;
    guestBId: string;
    note?: string;
  }>;
  removeConstraints?: string[];
  addTables?: Array<{
    label?: string;
    shape?: "round" | "rect";
    capacity?: number;
    x?: number;
    y?: number;
    rotation?: number;
  }>;
  removeTables?: string[];
  updateTables?: Record<
    string,
    Partial<{
      label: string;
      shape: "round" | "rect";
      capacity: number;
      x: number;
      y: number;
      rotation: number;
    }>
  >;
}

export type ValidateResult =
  | { ok: true; payload: ApplyPayload }
  | { ok: false; errors: string[] };

export function validateApply(raw: unknown): ValidateResult {
  if (!validateSchema(raw)) {
    const errors = (validateSchema.errors ?? []).map(
      (e) => `${e.instancePath || "<root>"} ${e.message ?? "invalid"}`,
    );
    return { ok: false, errors };
  }
  return { ok: true, payload: raw as ApplyPayload };
}

/** Append an entry to session.json (caps at last 10). */
export async function appendSession(
  root: string,
  entry: {
    appliedAt: string;
    agent?: string;
    note?: string;
    summary: { moves: number; removed: number; constraintsAdded: number; constraintsRemoved: number };
  },
): Promise<void> {
  const p = workspacePaths(root);
  let existing: { exchanges: unknown[] } = { exchanges: [] };
  try {
    const raw = await fs.readFile(p.session, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.exchanges)) existing = parsed;
  } catch {
    /* missing or unparseable — start fresh */
  }
  const next = {
    specVersion: "1.0",
    updatedAt: new Date().toISOString(),
    exchanges: [...existing.exchanges, entry].slice(-10),
  };
  await fs.writeFile(p.session, JSON.stringify(next, null, 2) + "\n", "utf8");
}

/** Move a processed file into archive/<year>/<month>/, optionally with a suffix. */
export async function archiveAppliedFile(
  absoluteFile: string,
  root: string,
  suffix?: string,
): Promise<void> {
  const p = workspacePaths(root);
  const now = new Date();
  const dir = path.join(
    p.archive,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
  );
  await fs.mkdir(dir, { recursive: true });
  const base = path.basename(absoluteFile);
  const target = suffix
    ? path.join(dir, base.replace(/(\.json)?$/, `.${suffix}$1`))
    : path.join(dir, base);
  await fs.rename(absoluteFile, target);
}
