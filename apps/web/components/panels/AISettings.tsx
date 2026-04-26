"use client";

import * as React from "react";
import { useEventStore, type AIProvider } from "@/lib/store";

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o",
};

const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
};

export function AISettingsButton() {
  const aiProvider = useEventStore((s) => s.aiProvider);
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        className={
          "flex h-7 w-7 items-center justify-center rounded text-base hover:bg-secondary " +
          (aiProvider ? "text-primary" : "text-muted-foreground hover:text-foreground")
        }
        onClick={() => setOpen(true)}
        title={aiProvider ? `AI: ${PROVIDER_LABELS[aiProvider]}` : "Configure AI assistant"}
        aria-label="AI settings"
      >
        ⚙
      </button>
      {open && <AISettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AISettingsModal({ onClose }: { onClose: () => void }) {
  const aiProvider = useEventStore((s) => s.aiProvider);
  const aiModel = useEventStore((s) => s.aiModel);
  const aiKey = useEventStore((s) => s.aiKey);
  const setAIConfig = useEventStore((s) => s.setAIConfig);

  const [provider, setProvider] = React.useState<AIProvider>(aiProvider ?? "anthropic");
  const [model, setModel] = React.useState(aiModel ?? DEFAULT_MODELS[provider]);
  const [key, setKey] = React.useState(aiKey ?? "");
  const [showKey, setShowKey] = React.useState(false);

  // Auto-fill the model field with the provider default whenever the user
  // toggles providers (unless they've already typed a custom model).
  React.useEffect(() => {
    if (model === DEFAULT_MODELS.anthropic || model === DEFAULT_MODELS.openai || !model) {
      setModel(DEFAULT_MODELS[provider]);
    }
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    setAIConfig({ provider, model: model.trim() || DEFAULT_MODELS[provider], key: key.trim() || null });
    onClose();
  };

  const disconnect = () => {
    setAIConfig({ provider: null, model: null, key: null });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[440px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">AI assistant settings</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Bring your own key. Stored in your browser only — Centerpeace never persists or
            logs it.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4 text-xs">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Provider
            </label>
            <div className="flex gap-2">
              {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={
                    "flex-1 rounded border px-3 py-2 text-left transition-colors " +
                    (provider === p
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input bg-background hover:bg-secondary")
                  }
                >
                  <div className="font-medium">{PROVIDER_LABELS[p]}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODELS[provider]}
              className="block w-full rounded border border-input bg-background px-2 py-1.5 font-mono text-[11px]"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Default is good for most uses. Override only if you know which model you want.
            </p>
          </div>

          <div>
            <label className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>API key</span>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="text-[10px] normal-case tracking-normal text-primary hover:underline"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </label>
            <input
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                provider === "anthropic" ? "sk-ant-…" : "sk-…"
              }
              className="block w-full rounded border border-input bg-background px-2 py-1.5 font-mono text-[11px]"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {provider === "anthropic" ? (
                <>
                  Get a key at{" "}
                  <a
                    className="text-primary hover:underline"
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    console.anthropic.com
                  </a>
                  .
                </>
              ) : (
                <>
                  Get a key at{" "}
                  <a
                    className="text-primary hover:underline"
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    platform.openai.com
                  </a>
                  .
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-5 py-3">
          {aiProvider ? (
            <button
              onClick={disconnect}
              className="text-xs text-destructive hover:underline"
            >
              Disconnect
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!key.trim()}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
