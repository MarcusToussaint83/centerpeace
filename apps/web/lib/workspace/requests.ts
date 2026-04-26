/**
 * Create request files for the agent to read.
 *
 * Filename pattern: `<type>-<safe-timestamp>.md`
 * Body: YAML frontmatter + human-readable prompt.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { workspacePaths } from "./paths";

export type RequestType =
  | "suggest-arrangement"
  | "review-table"
  | "find-conflicts"
  | "explain-arrangement"
  | "propose-constraint";

const PROMPTS: Record<RequestType, string> = {
  "suggest-arrangement":
    "Propose seat assignments for unseated guests. Respect must_sit_with and must_not_sit_with relationships. Do not move locked seats. Return a complete response per `schemas/response.schema.json`.",
  "review-table":
    "Review the listed table's seating and suggest improvements with reasoning. If everything looks right, say so explicitly.",
  "find-conflicts":
    "Identify any constraint violations in the current arrangement and propose minimal moves to resolve them.",
  "explain-arrangement":
    "Produce a stakeholder-ready briefing of the current seating rationale, suitable for sharing with a board chair or ED.",
  "propose-constraint":
    "Translate the user's note below into one or more structured constraints. Surface ambiguity in your reasoning rather than guessing.",
};

export interface CreateRequestInput {
  root: string;
  type: RequestType;
  /** Free-form note from the user that will be embedded in the request body. */
  note?: string;
  /** Optional structured scope (e.g., specific tableId for `review-table`). */
  scope?: Record<string, unknown>;
}

export interface CreateRequestResult {
  filename: string;
  absolutePath: string;
  requestId: string;
}

export async function createRequest(input: CreateRequestInput): Promise<CreateRequestResult> {
  const { root, type, note, scope } = input;
  const p = workspacePaths(root);

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const requestId = `req_${now.getTime().toString(36)}`;
  const filename = `${type}-${stamp}.md`;
  const absolutePath = path.join(p.requests, filename);

  const frontmatter = [
    "---",
    `specVersion: "1.0"`,
    `requestId: "${requestId}"`,
    `type: "${type}"`,
    `createdAt: "${now.toISOString()}"`,
    scope ? `scope: ${JSON.stringify(scope)}` : null,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const body = [
    frontmatter,
    "",
    `# Request: ${type}`,
    "",
    PROMPTS[type],
    note ? `\nUser note:\n\n> ${note.replace(/\n/g, "\n> ")}` : "",
    "",
    `Write your response to:`,
    "`responses/" + type + "-" + stamp + "-response.json`",
    "",
    "Match the schema at `schemas/response.schema.json`.",
    "",
  ].join("\n");

  await fs.mkdir(p.requests, { recursive: true });
  await fs.writeFile(absolutePath, body, "utf8");

  return { filename, absolutePath, requestId };
}

/** Append an entry to session.json (caps at last 10 exchanges). */
export async function appendSession(
  root: string,
  entry: {
    requestId: string;
    requestType: string;
    requestSummary?: string;
    responseSummary: string;
    completedAt: string;
    accepted: "full" | "partial" | "rejected";
  },
): Promise<void> {
  const p = workspacePaths(root);
  let existing: { exchanges: unknown[] } = { exchanges: [] };
  try {
    const raw = await fs.readFile(p.session, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.exchanges)) existing = parsed;
  } catch {
    // missing or unparseable — start fresh
  }
  const next = {
    specVersion: "1.0",
    updatedAt: new Date().toISOString(),
    exchanges: [...existing.exchanges, entry].slice(-10),
  };
  await fs.writeFile(p.session, JSON.stringify(next, null, 2) + "\n", "utf8");
}

/** Move a response file into archive/<year>/<month>/. Used for accepted/rejected/invalid. */
export async function archiveResponseFile(absoluteFile: string, root: string, suffix?: string): Promise<void> {
  const p = workspacePaths(root);
  const now = new Date();
  const dir = path.join(p.archive, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
  await fs.mkdir(dir, { recursive: true });
  const base = path.basename(absoluteFile);
  const target = suffix
    ? path.join(dir, base.replace(/(\.json)?$/, `.${suffix}$1`))
    : path.join(dir, base);
  await fs.rename(absoluteFile, target);
}
