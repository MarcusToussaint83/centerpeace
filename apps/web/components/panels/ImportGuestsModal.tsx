"use client";

import * as React from "react";
import { FileUp, Upload, X } from "lucide-react";

import { useEventStore } from "@/lib/store";
import { parseGuestsCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";

const SAMPLE = `Name,Affiliation,Notes
Naomi Carter,Carter Foundation,VIP — major donor
Henry Carter,Carter Foundation,Naomi's spouse
Marcus Toussaint,The Toussaint Sisters Co.,Host`;

/**
 * Modal: paste CSV / one-name-per-line text or upload a .csv, see a preview,
 * import. Lives as a portal-less overlay so it works inside the existing layout.
 */
export function ImportGuestsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const importGuests = useEventStore((s) => s.importGuests);
  const [text, setText] = React.useState("");
  const [confirmation, setConfirmation] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setText("");
      setConfirmation(null);
    }
  }, [open]);

  const parsed = React.useMemo(() => parseGuestsCSV(text), [text]);

  const onFile = async (file: File) => {
    const t = await file.text();
    setText(t);
  };

  const onImport = () => {
    const added = importGuests(parsed.rows);
    const dupes = parsed.rows.length - added;
    setConfirmation(
      `Added ${added} guest${added === 1 ? "" : "s"}` +
        (dupes > 0 ? ` (${dupes} duplicate${dupes === 1 ? "" : "s"} skipped)` : ""),
    );
    setText("");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold tracking-tight">
            <FileUp className="size-4 text-muted-foreground" />
            Import guests
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <p className="text-xs text-muted-foreground">
            Paste a CSV (with optional <code>Name, Affiliation, Notes</code>{" "}
            header) or one name per line. Or upload a <code>.csv</code> file.
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={SAMPLE}
            rows={10}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
              <Upload className="size-3.5" />
              Upload .csv
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              onClick={() => setText(SAMPLE)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Insert example
            </button>
          </div>

          {parsed.rows.length > 0 && (
            <div className="rounded-md border border-border">
              <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Preview ({parsed.rows.length} rows)</span>
                {parsed.skipped > 0 && (
                  <span>{parsed.skipped} blank skipped</span>
                )}
              </div>
              <ul className="max-h-48 divide-y divide-border overflow-y-auto text-xs">
                {parsed.rows.slice(0, 50).map((r, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="font-medium">{r.name}</span>
                    {r.affiliation && (
                      <span className="text-muted-foreground">
                        · {r.affiliation}
                      </span>
                    )}
                    {r.notes && (
                      <span className="ml-auto truncate text-[11px] italic text-muted-foreground">
                        {r.notes}
                      </span>
                    )}
                  </li>
                ))}
                {parsed.rows.length > 50 && (
                  <li className="px-3 py-1.5 text-[11px] italic text-muted-foreground">
                    …and {parsed.rows.length - 50} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {confirmation && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              {confirmation}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Done
          </button>
          <button
            onClick={onImport}
            disabled={parsed.rows.length === 0}
            className={cn(
              "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90",
              parsed.rows.length === 0 && "cursor-not-allowed opacity-40",
            )}
          >
            Import {parsed.rows.length || ""}
            {parsed.rows.length > 0
              ? ` guest${parsed.rows.length === 1 ? "" : "s"}`
              : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
