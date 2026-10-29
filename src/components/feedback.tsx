"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

/*
 * In-app replacements for the browser's confirm() and alert():
 *   const { confirm, toast } = useFeedback();
 *   if (!(await confirm({ title: "Delete offer?", tone: "danger" }))) return;
 *   toast.error("It couldn't be saved.");
 * The provider is mounted once in the workspace shell.
 */

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  /** Ask for a reason (required): the dialog shows a text box and resolves with what was typed. */
  reasonLabel?: string;
};
type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

type Feedback = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Like confirm, with a required reason; resolves with the reason, or null if cancelled. */
  askReason: (options: ConfirmOptions) => Promise<string | null>;
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
};

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: string | null) => void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...options, reasonLabel: undefined, resolve: (v) => resolve(v !== null) })),
    [],
  );
  const askReason = useCallback(
    (options: ConfirmOptions) => new Promise<string | null>((resolve) => setDialog({ ...options, reasonLabel: options.reasonLabel ?? "Reason", resolve })),
    [],
  );

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);

  const [toast] = useState(() => ({
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
    info: (m: string) => push("info", m),
  }));

  const close = (value: string | null) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ confirm, askReason, toast }}>
      {children}
      {dialog && <ConfirmDialog options={dialog} onClose={close} />}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-full max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-xl shadow-slate-900/10"
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            ) : t.kind === "error" ? (
              <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            )}
            <p className="flex-1 text-slate-700">{t.message}</p>
            <button
              type="button"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="text-slate-400 hover:text-navy"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (value: string | null) => void }) {
  const confirmButton = useRef<HTMLButtonElement>(null);
  const reasonBox = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const danger = options.tone === "danger";
  const needsReason = !!options.reasonLabel;
  const ok = !needsReason || reason.trim().length >= 3;

  useEffect(() => {
    if (reasonBox.current) reasonBox.current.focus();
    else confirmButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-deep/40 p-4" onMouseDown={() => onClose(null)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="flex gap-4">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-red-50 text-danger" : "bg-brand-soft text-brand"}`}
          >
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="confirm-title" className="font-semibold text-navy">
              {options.title}
            </h2>
            {options.message && <p className="mt-1 text-sm text-muted">{options.message}</p>}
          </div>
        </div>
        {needsReason && (
          <label className="mt-4 block text-[13px] font-medium text-slate-700">
            {options.reasonLabel} *
            <textarea
              ref={reasonBox}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(null)}
            className="h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-slate-700 hover:bg-surface-2"
          >
            {options.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={confirmButton}
            type="button"
            disabled={!ok}
            onClick={() => onClose(needsReason ? reason.trim() : "yes")}
            className={`h-10 rounded-lg px-4 disabled:opacity-50 text-sm font-medium text-white shadow-sm ${danger ? "bg-danger hover:bg-red-700" : "bg-navy hover:bg-navy-deep"}`}
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
