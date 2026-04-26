/**
 * Browser-side client for /api/workspace.
 *
 * Thin wrapper that returns parsed JSON or throws with a useful message.
 */

import type { ApplyPayload } from "./apply";

type Action =
  | "default-path"
  | "bootstrap"
  | "sync"
  | "status"
  | "clear"
  | "open-folder"
  | "archive-applied";

async function call<T>(action: Action, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string })?.error || `Workspace ${action} failed`);
  }
  return json as T;
}

export const workspaceClient = {
  defaultPath: (eventName: string) =>
    call<{ path: string }>("default-path", { eventName }),
  bootstrap: (path: string) =>
    call<{ root: string; created: boolean; wrote: string[] }>("bootstrap", { path }),
  sync: (path: string, state: Record<string, unknown>) =>
    call<{ ok: true; syncedAt: string }>("sync", { path, state }),
  status: (path: string) =>
    call<{ exists: boolean; hasReadme?: boolean; hasState?: boolean }>("status", { path }),
  clear: (path: string) => call<{ ok: true }>("clear", { path }),
  openFolder: (path: string) => call<{ ok: true }>("open-folder", { path }),
  archiveApplied: (input: {
    path: string;
    file: string;
    note?: string;
    agent?: string;
    summary: {
      moves: number;
      removed: number;
      constraintsAdded: number;
      constraintsRemoved: number;
    };
  }) => call<{ ok: true }>("archive-applied", input),
};

/**
 * Subscribe to workspace events. Returns an unsubscribe function.
 * Fires when validated apply files arrive, or when an invalid file is seen.
 */
export interface WorkspaceEventHandlers {
  onApplied?: (e: { file: string; payload: ApplyPayload }) => void;
  onInvalid?: (e: { file: string; errors: string[] }) => void;
  onError?: (err: unknown) => void;
}

export function subscribeWorkspace(
  workspacePath: string,
  handlers: WorkspaceEventHandlers,
): () => void {
  const url = `/api/workspace/events?path=${encodeURIComponent(workspacePath)}`;
  const es = new EventSource(url);
  es.addEventListener("applied", (ev) => {
    try {
      handlers.onApplied?.(JSON.parse((ev as MessageEvent).data));
    } catch (e) {
      handlers.onError?.(e);
    }
  });
  es.addEventListener("invalid", (ev) => {
    try {
      handlers.onInvalid?.(JSON.parse((ev as MessageEvent).data));
    } catch (e) {
      handlers.onError?.(e);
    }
  });
  es.addEventListener("error", (e) => handlers.onError?.(e));
  return () => es.close();
}
