"use client";

/**
 * Floating BYOK chat panel.
 *
 * Renders only when the user has configured an API key. Lives bottom-right,
 * collapsed to a small launcher by default. Conversation is in-memory only
 * (cleared when the page reloads).
 *
 * The hook talks to /api/ai/chat with a custom body that includes the live
 * event state. When the model calls the `apply_change` tool, this component
 * runs the change through `useEventStore.applyChange` (which snapshots a
 * version automatically), then sends the result back to the model so it can
 * continue.
 */

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useEventStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";

export function AIChatPanel() {
  const aiProvider = useEventStore((s) => s.aiProvider);
  const aiModel = useEventStore((s) => s.aiModel);
  const aiKey = useEventStore((s) => s.aiKey);
  const applyChange = useEventStore((s) => s.applyChange);

  const [open, setOpen] = React.useState(false);

  // Don't render anything until BYOK is configured. The ⚙ button in the
  // toolbar is the entry point for setup.
  if (!aiProvider || !aiKey || !aiModel) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground shadow-lg hover:bg-primary/90"
          title="AI assistant"
          aria-label="Open AI assistant"
        >
          ✨
        </button>
      )}
      {open && (
        <ChatCard
          provider={aiProvider}
          model={aiModel}
          apiKey={aiKey}
          applyChange={applyChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ChatCard({
  provider,
  model,
  apiKey,
  applyChange,
  onClose,
}: {
  provider: "anthropic" | "openai";
  model: string;
  apiKey: string;
  applyChange: ReturnType<typeof useEventStore.getState>["applyChange"];
  onClose: () => void;
}) {
  // Pull state with shallow equality so re-renders don't re-create the
  // useChat hook between keystrokes.
  const stateForBody = useEventStore(
    useShallow((s) => ({
      name: s.name,
      guests: s.guests,
      tables: s.tables.map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        shape: t.shape,
      })),
      assignments: s.assignments,
      constraints: s.constraints,
    })),
  );

  // Stash the live state in a ref so the transport's body resolver always
  // sends the freshest snapshot without re-creating the hook.
  const stateRef = React.useRef(stateForBody);
  React.useEffect(() => {
    stateRef.current = stateForBody;
  }, [stateForBody]);

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: () => ({
          provider,
          model,
          apiKey,
          state: stateRef.current,
        }),
      }),
    [provider, model, apiKey],
  );

  const { messages, sendMessage, status, addToolResult, error, stop } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === "apply_change") {
        const input = toolCall.input as Parameters<typeof applyChange>[0] & {
          note?: string;
        };
        try {
          const summary = applyChange({
            assignments: input.assignments,
            removeAssignments: input.removeAssignments,
            addConstraints: input.addConstraints,
            removeConstraints: input.removeConstraints,
            addTables: input.addTables,
            removeTables: input.removeTables,
            updateTables: input.updateTables,
            label: input.note ? `AI · ${input.note}` : undefined,
          });
          addToolResult({
            tool: "apply_change",
            toolCallId: toolCall.toolCallId,
            output: { ok: true, ...summary },
          });
        } catch (e) {
          addToolResult({
            tool: "apply_change",
            toolCallId: toolCall.toolCallId,
            output: { ok: false, error: e instanceof Error ? e.message : String(e) },
          });
        }
      }
    },
  });

  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, status]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    setInput("");
    sendMessage({ text });
  };

  const busy = status === "streaming" || status === "submitted";

  return (
    <div className="fixed bottom-4 right-4 z-30 flex h-[560px] w-[400px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <div>
            <div className="text-xs font-semibold">AI assistant</div>
            <div className="text-[10px] text-muted-foreground">
              {provider} · {model}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-xs">
        {messages.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-3 text-[11px] text-muted-foreground">
            Try: <em>{`"Move Sarah Chen to Table 3."`}</em>{" "}
            <em>{`"Populate the empty seats — big donors near Table 1, spouses together."`}</em>{" "}
            <em>{`"Find any constraint conflicts."`}</em>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {error && (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
            {error.message}
          </div>
        )}
      </div>

      <form
        onSubmit={submit}
        className="flex items-end gap-2 border-t border-border bg-secondary/30 px-3 py-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e as unknown as React.FormEvent);
            }
          }}
          rows={1}
          placeholder="Ask the AI to move people, add constraints…"
          className="max-h-32 min-h-[2rem] flex-1 resize-none rounded border border-input bg-background px-2 py-1.5 text-xs"
          disabled={busy}
        />
        {busy ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-secondary/80"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: import("ai").UIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "ml-auto max-w-[85%]" : "mr-auto max-w-[95%]"}>
      <div
        className={
          "rounded-lg px-3 py-2 text-[12px] leading-relaxed " +
          (isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground")
        }
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <div key={i} className="whitespace-pre-wrap">
                {part.text}
              </div>
            );
          }
          if (part.type.startsWith("tool-")) {
            // Tool invocation. v6 represents these as 'tool-<toolName>' parts.
            const toolPart = part as unknown as {
              type: string;
              state: string;
              input?: { note?: string };
              output?: { ok: boolean; moves?: number; constraintsAdded?: number };
            };
            const toolName = part.type.slice("tool-".length);
            if (toolName === "apply_change") {
              if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
                return (
                  <div
                    key={i}
                    className="my-1 rounded border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    📍 Preparing change…
                  </div>
                );
              }
              if (toolPart.state === "output-available") {
                const summary = toolPart.output;
                const note = toolPart.input?.note;
                return (
                  <div
                    key={i}
                    className="my-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-400"
                  >
                    ✓ Applied{summary?.moves ? ` · ${summary.moves} placed` : ""}
                    {note && (
                      <div className="mt-0.5 text-emerald-700/80 dark:text-emerald-400/80">{note}</div>
                    )}
                  </div>
                );
              }
              if (toolPart.state === "output-error") {
                return (
                  <div
                    key={i}
                    className="my-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive"
                  >
                    ✗ Tool error
                  </div>
                );
              }
            }
          }
          return null;
        })}
      </div>
    </div>
  );
}
