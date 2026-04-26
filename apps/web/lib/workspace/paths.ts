/**
 * Workspace path resolution.
 *
 * Server-side only. The default workspace path lives under the user's home
 * directory so that across self-hosted installs the location is predictable.
 */

import os from "node:os";
import path from "node:path";

/** Slugify a free-form event name into a filesystem-safe directory segment. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .slice(0, 60) || "event"
  );
}

/** Default workspace root for a given event. */
export function defaultWorkspacePath(eventName: string): string {
  return path.join(
    os.homedir(),
    "Documents",
    "Centerpeace",
    slugify(eventName),
  );
}

/** Subpaths inside a workspace root. */
export function workspacePaths(root: string) {
  return {
    root,
    readme: path.join(root, "README.md"),
    orgContext: path.join(root, "org-context.md"),
    currentState: path.join(root, "current-state.json"),
    session: path.join(root, "session.json"),
    guestsCsv: path.join(root, "guests.csv"),
    tablesMd: path.join(root, "tables.md"),
    constraintsMd: path.join(root, "constraints.md"),
    gitignore: path.join(root, ".gitignore"),
    schemas: path.join(root, "schemas"),
    requestSchema: path.join(root, "schemas", "request.schema.json"),
    responseSchema: path.join(root, "schemas", "response.schema.json"),
    examples: path.join(root, "schemas", "examples"),
    exampleResponse: path.join(root, "schemas", "examples", "suggest-arrangement-response.json"),
    requests: path.join(root, "requests"),
    responses: path.join(root, "responses"),
    proposedChanges: path.join(root, "proposed-changes"),
    archive: path.join(root, "archive"),
  };
}

export type WorkspacePaths = ReturnType<typeof workspacePaths>;
