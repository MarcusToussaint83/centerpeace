/**
 * Browser-side client for /api/workspace.
 *
 * Thin wrapper that returns parsed JSON or throws with a useful message.
 * Server-side filesystem unavailability surfaces here as a 5xx; callers
 * are expected to fail soft.
 */

type Action = "default-path" | "bootstrap" | "sync" | "status" | "clear";

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
};
