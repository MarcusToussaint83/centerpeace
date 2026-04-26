/**
 * Workspace control plane.
 *
 * POST /api/workspace with { action, ... } where action is one of:
 *   - "default-path"  → returns the default workspace path for an event
 *   - "bootstrap"     → create directory tree + seed templates at `path`
 *   - "sync"          → write current event state into the workspace
 *   - "status"        → check whether a workspace exists at `path`
 *   - "clear"         → delete workspace contents (keeps archive)
 *
 * Filesystem is required; in environments without fs (Vercel edge) every
 * action returns 501 so the client knows to hide the agent UI.
 */

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exec } from "node:child_process";

import { bootstrapWorkspace, clearWorkspace } from "@/lib/workspace/bootstrap";
import { defaultWorkspacePath, workspacePaths } from "@/lib/workspace/paths";
import { syncWorkspace } from "@/lib/workspace/sync";
import {
  createRequest,
  appendSession,
  archiveResponseFile,
  type RequestType,
} from "@/lib/workspace/requests";

export const runtime = "nodejs";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Reject paths that try to escape outside the user's home directory. */
function isSafeWorkspacePath(p: string): boolean {
  if (!p || typeof p !== "string") return false;
  const abs = path.resolve(p);
  const home = os.homedir();
  // Must live under home and must not contain traversal artefacts.
  return abs.startsWith(home + path.sep) && !abs.includes("..");
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body?.action;

  try {
    switch (action) {
      case "default-path": {
        const eventName = String(body?.eventName ?? "event");
        return NextResponse.json({ path: defaultWorkspacePath(eventName) });
      }

      case "bootstrap": {
        const root = String(body?.path ?? "");
        if (!isSafeWorkspacePath(root)) {
          return NextResponse.json(
            { error: "Workspace path must be inside your home directory." },
            { status: 400 },
          );
        }
        const result = await bootstrapWorkspace(root);
        return NextResponse.json(result);
      }

      case "sync": {
        const root = String(body?.path ?? "");
        if (!isSafeWorkspacePath(root)) {
          return NextResponse.json({ error: "Invalid workspace path." }, { status: 400 });
        }
        const state = body?.state;
        if (!state || typeof state !== "object") {
          return NextResponse.json({ error: "Missing state." }, { status: 400 });
        }
        await syncWorkspace({ root, state: state as Parameters<typeof syncWorkspace>[0]["state"] });
        return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() });
      }

      case "status": {
        const root = String(body?.path ?? "");
        if (!root) return NextResponse.json({ exists: false });
        const p = workspacePaths(root);
        const present = await exists(p.root);
        return NextResponse.json({
          exists: present,
          hasReadme: present && (await exists(p.readme)),
          hasState: present && (await exists(p.currentState)),
        });
      }

      case "clear": {
        const root = String(body?.path ?? "");
        if (!isSafeWorkspacePath(root)) {
          return NextResponse.json({ error: "Invalid workspace path." }, { status: 400 });
        }
        await clearWorkspace(root);
        return NextResponse.json({ ok: true });
      }

      case "open-folder": {
        const root = String(body?.path ?? "");
        if (!isSafeWorkspacePath(root)) {
          return NextResponse.json({ error: "Invalid workspace path." }, { status: 400 });
        }
        if (!(await exists(root))) {
          return NextResponse.json({ error: "Folder does not exist." }, { status: 404 });
        }
        // Quote the path to defend against spaces; isSafeWorkspacePath already
        // rejects traversal and anything outside HOME.
        const quoted = JSON.stringify(root);
        const cmd =
          process.platform === "darwin"
            ? `open ${quoted}`
            : process.platform === "win32"
              ? `explorer ${quoted}`
              : `xdg-open ${quoted}`;
        await new Promise<void>((resolve, reject) => {
          exec(cmd, (err) => (err ? reject(err) : resolve()));
        });
        return NextResponse.json({ ok: true });
      }

      case "create-request": {
        const root = String(body?.path ?? "");
        if (!isSafeWorkspacePath(root)) {
          return NextResponse.json({ error: "Invalid workspace path." }, { status: 400 });
        }
        const type = String(body?.type ?? "") as RequestType;
        const note = body?.note ? String(body.note) : undefined;
        const scope = body?.scope as Record<string, unknown> | undefined;
        const result = await createRequest({ root, type, note, scope });
        return NextResponse.json(result);
      }

      case "accept-response":
      case "reject-response": {
        const root = String(body?.path ?? "");
        if (!isSafeWorkspacePath(root)) {
          return NextResponse.json({ error: "Invalid workspace path." }, { status: 400 });
        }
        const file = String(body?.file ?? "");
        const accepted: "full" | "rejected" =
          action === "accept-response" ? "full" : "rejected";
        // file must live inside the workspace responses/ folder.
        const p = workspacePaths(root);
        const abs = path.resolve(file);
        if (!abs.startsWith(p.responses + path.sep)) {
          return NextResponse.json({ error: "File outside workspace." }, { status: 400 });
        }
        const summary = body?.summary ? String(body.summary) : "";
        const requestId = body?.requestId ? String(body.requestId) : "";
        const requestType = body?.requestType ? String(body.requestType) : "";
        await appendSession(root, {
          requestId,
          requestType,
          responseSummary: summary,
          completedAt: new Date().toISOString(),
          accepted,
        });
        await archiveResponseFile(abs, root, accepted === "rejected" ? "rejected" : undefined);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
