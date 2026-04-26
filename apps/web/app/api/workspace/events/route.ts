/**
 * Server-sent events stream for workspace responses.
 *
 * GET /api/workspace/events?path=<absolute-workspace-root>
 *
 * Opens a chokidar watcher on the workspace's responses/ folder. Each new
 * JSON file is parsed + schema-validated and pushed to the client as one of:
 *
 *   event: proposal      — { id, file, response, references }
 *   event: invalid       — { id, file, errors }
 *   event: ping          — periodic keepalive
 *
 * The watcher is torn down when the client disconnects.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import chokidar from "chokidar";

import { workspacePaths } from "@/lib/workspace/paths";
import { validateResponse } from "@/lib/workspace/validate";
import { archiveResponseFile } from "@/lib/workspace/requests";

export const runtime = "nodejs";
// Long-lived stream; do not cache.
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
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // controller closed; ignore
        }
      };

      // Initial hello so clients know the connection is live.
      send("ping", { ok: true, watching: p.responses });

      // Keepalive every 25s so proxies don't drop the connection.
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
            await archiveResponseFile(filePath, root, "invalid").catch(() => {});
            return;
          }
          const validation = validateResponse(parsed);
          if (!validation.ok) {
            send("invalid", { file: filePath, errors: validation.errors });
            await archiveResponseFile(filePath, root, "invalid").catch(() => {});
            return;
          }
          send("proposal", {
            file: filePath,
            response: validation.response,
          });
        } catch (e) {
          send("invalid", {
            file: filePath,
            errors: [(e as Error).message],
          });
        }
      };

      const watcher = chokidar.watch(p.responses, {
        ignored: /(^|[\\/\\])\../, // dotfiles
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      });

      watcher.on("add", handleFile);

      // Cleanup on disconnect.
      const cleanup = async () => {
        clearInterval(keepalive);
        await watcher.close().catch(() => {});
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      // The Request signal fires when the client disconnects.
      req.signal.addEventListener("abort", () => {
        void cleanup();
      });
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
