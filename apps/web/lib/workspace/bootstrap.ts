/**
 * Bootstrap a fresh agent workspace on disk.
 *
 * Creates the directory tree and writes only the files that don't already
 * exist — re-running bootstrap is safe and won't clobber a user-edited
 * README or org-context.
 */

import fs from "node:fs/promises";
import {
  GITIGNORE,
  ORG_CONTEXT,
  README,
  REQUEST_SCHEMA,
  RESPONSE_SCHEMA,
  EXAMPLE_RESPONSE,
} from "./templates";
import { workspacePaths, type WorkspacePaths } from "./paths";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Write file only if it doesn't already exist. Preserves user edits. */
async function writeIfMissing(filePath: string, contents: string): Promise<boolean> {
  if (await exists(filePath)) return false;
  await fs.writeFile(filePath, contents, "utf8");
  return true;
}

export interface BootstrapResult {
  root: string;
  created: boolean;
  wrote: string[];
}

/**
 * Create the workspace directory tree and seed the template files.
 * Idempotent: safe to call repeatedly.
 */
export async function bootstrapWorkspace(root: string): Promise<BootstrapResult> {
  const p = workspacePaths(root);
  const created = !(await exists(p.root));

  // Create directories.
  await fs.mkdir(p.root, { recursive: true });
  await fs.mkdir(p.schemas, { recursive: true });
  await fs.mkdir(p.examples, { recursive: true });
  await fs.mkdir(p.requests, { recursive: true });
  await fs.mkdir(p.responses, { recursive: true });
  await fs.mkdir(p.proposedChanges, { recursive: true });
  await fs.mkdir(p.archive, { recursive: true });

  const wrote: string[] = [];
  // Templates (skipped if user already edited them).
  if (await writeIfMissing(p.readme, README)) wrote.push(p.readme);
  if (await writeIfMissing(p.orgContext, ORG_CONTEXT)) wrote.push(p.orgContext);
  if (await writeIfMissing(p.gitignore, GITIGNORE)) wrote.push(p.gitignore);

  // Schemas — these are versioned API and we always rewrite them.
  await fs.writeFile(p.requestSchema, JSON.stringify(REQUEST_SCHEMA, null, 2), "utf8");
  wrote.push(p.requestSchema);
  await fs.writeFile(p.responseSchema, JSON.stringify(RESPONSE_SCHEMA, null, 2), "utf8");
  wrote.push(p.responseSchema);
  await fs.writeFile(p.exampleResponse, EXAMPLE_RESPONSE, "utf8");
  wrote.push(p.exampleResponse);

  return { root: p.root, created, wrote };
}

/** Best-effort delete the workspace, preserving the archive folder. */
export async function clearWorkspace(root: string): Promise<void> {
  const p = workspacePaths(root);
  // Remove everything except archive/. Recreate empty subdirs.
  for (const target of [
    p.readme,
    p.orgContext,
    p.gitignore,
    p.currentState,
    p.session,
    p.guestsCsv,
    p.tablesMd,
    p.constraintsMd,
    p.requestSchema,
    p.responseSchema,
    p.exampleResponse,
  ]) {
    await fs.rm(target, { force: true });
  }
  for (const dir of [p.requests, p.responses, p.proposedChanges, p.schemas, p.examples]) {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export { workspacePaths };
export type { WorkspacePaths };
