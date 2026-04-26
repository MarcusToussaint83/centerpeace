/**
 * Browser-side client for /api/workspace.
 *
 * Thin wrapper that returns parsed JSON or throws with a useful message.
 * Server-side filesystem unavailability surfaces here as a 5xx; callers
 * are expected to fail soft.
 */

type Action =
  | "default-path"
  | "bootstrap"
  | "sync"
  | "status"
  | "clear"
  | "create-request"
  | "accept-response"
  | "reject-response"
  | "open-folder";

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

  createRequest: (input: {
    path: string;
    type: string;
    note?: string;
    scope?: Record<string, unknown>;
  }) =>
    call<{ filename: string; absolutePath: string; requestId: string }>(
      "create-request",
      input,
    ),

  acceptResponse: (input: {
    path: string;
    file: string;
    requestId: string;
    requestType: string;
    summary: string;
  }) => call<{ ok: true }>("accept-response", input),

  rejectResponse: (input: {
    path: string;
    file: string;
    requestId: string;
    requestType: string;
    summary: string;
  }) => call<{ ok: true }>("reject-response", input),
};

/**
 * Subscribe to workspace events. Returns an unsubscribe function.
 * Handlers fire when validated proposals arrive or invalid files are seen.
 */
export interface WorkspaceEventHandlers {
  onProposal?: (e: { file: string; response: import("./validate").AgentResponse }) => void;
  onInvalid?: (e: { file: string; errors: string[] }) => void;
  onError?: (err: unknown) => void;
}

export function subscribeWorkspace(
  workspacePath: string,
  handlers: WorkspaceEventHandlers,
): () => void {
  const url = `/api/workspace/events?path=${encodeURIComponent(workspacePath)}`;
  const es = new EventSource(url);
  es.addEventListener("proposal", (ev) => {
    try {
      handlers.onProposal?.(JSON.parse((ev as MessageEvent).data));
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
