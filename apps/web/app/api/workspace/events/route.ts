/**
 * Server-sent events stream for workspace changes.
 *
 * GET /api/workspace/events?path=<absolute-workspace-root>
 *
 * Watches `proposed-changes/` with chokidar. For each new JSON file:
 *   - parse + schema-validate
 *   - emit `applied` (validated payload + file path) so the client can run
 *     the change through the store and then call back to archive.
 *   - or emit `invalid` (errors) and the server archives with .invalid
 *
 *   event: applied   — { file, payload }
 *   event: invalid   — { file, errors }
 *   event: ping      — periodic keepalive
 *
 * The watcher is torn down when the client disconnects.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import chokidar from "chokidar";

import { workspacePaths } from "@/lib/workspace/paths";
import { validateApply, archiveAppliedFile } from "@/lib/workspace/apply";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSafeWorkspacePath(p: string): boolean {
  if (!p) return false;
  const abs = path.resolve(p);
  const home = os.homedir();
  return abs.startsWith(home + path.sep) && !abs.includes("..");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const root = url.searchParams.get("path") ?? "";
  if (!isSafeWorkspacePath(root)) {
    return new Response("Invalid workspace path", { status: 400 });
  }
  const p = workspacePaths(root);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* controller closed */
        }
      };

      send("ping", { ok: true, watching: p.proposedChanges });
      const keepalive = setInterval(() => send("ping", { t: Date.now() }), 25_000);

      const handleFile = async (filePath: string) => {
        if (!filePath.endsWith(".json")) return;
        try {
          const raw = await fs.readFile(filePath, "utf8");
          let parsed: unknown;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            send("invalid", {
              file: filePath,
              errors: [`JSON parse error: ${(e as Error).message}`],
            });
            await archiveAppliedFile(filePath, root, "invalid").catch(() => {});
            return;
          }
          const v = validateApply(parsed);
          if (!v.ok) {
            send("invalid", { file: filePath, errors: v.errors });
            await archiveAppliedFile(filePath, root, "invalid").catch(() => {});
            return;
          }
          send("applied", { file: filePath, payload: v.payload });
        } catch (e) {
          send("invalid", { file: filePath, errors: [(e as Error).message] });
        }
      };

      const watcher = chokidar.watch(p.proposedChanges, {
        ignored: /(^|[\\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      });
      watcher.on("add", handleFile);

      const cleanup = async () => {
        clearInterval(keepalive);
        await watcher.close().catch(() => {});
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", () => void cleanup());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
