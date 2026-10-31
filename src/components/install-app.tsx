"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "marineos:install-dismissed";
const DAYS = 14;

function dismissedRecently(dismissKey: string) {
  try {
    const at = Number(localStorage.getItem(dismissKey) ?? 0);
    return Date.now() - at < DAYS * 86_400_000;
  } catch {
    return false;
  }
}
function rememberDismiss(dismissKey: string) {
  try {
    localStorage.setItem(dismissKey, String(Date.now()));
  } catch {}
}

/**
 * Offers to install Marine OS as an app. Chrome, Edge and Android get the one-click install;
 * iPhone and iPad (Safari has no install button) get the two steps to add it to the home screen.
 * Hidden once installed, and for two weeks after "Not now".
 */
export function InstallApp({ title = "Install Marine OS", dismissKey = DISMISS_KEY }: { title?: string; dismissKey?: string } = {}) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || dismissedRecently(dismissKey)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setOpen(true);
    };
    const onInstalled = () => setOpen(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Safari on iPhone / iPad: no install event, so show the steps after a moment.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const timer = isIos
      ? setTimeout(() => {
          setIos(true);
          setOpen(true);
        }, 2500)
      : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, [dismissKey]);

  if (!open) return null;
  const close = () => {
    rememberDismiss(dismissKey);
    setOpen(false);
  };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="install-title" className="fixed inset-x-4 bottom-4 z-[75] mx-auto max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl shadow-slate-900/20 sm:left-auto sm:right-6 sm:mx-0">
      <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-surface-2 hover:text-navy">
        <X className="size-4" />
      </button>
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={56} height={56} className="size-14 shrink-0 rounded-2xl border border-border" />
        <div className="min-w-0">
          <h2 id="install-title" className="font-semibold text-navy">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {ios ? "Add it to your home screen to open it like an app, full screen." : "Open it like an app: its own window, icon on your desktop or home screen, faster to reach."}
          </p>
        </div>
      </div>

      {ios ? (
        <ol className="mt-4 space-y-2 text-sm text-slate-700">
          <li className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">1</span>
            Tap <Share className="size-4 text-brand" aria-label="Share" /> <strong>Share</strong> in Safari&apos;s toolbar
          </li>
          <li className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">2</span>
            Choose <SquarePlus className="size-4 text-brand" aria-hidden /> <strong>Add to Home Screen</strong>
          </li>
        </ol>
      ) : (
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={close} className="h-10 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-slate-700 hover:bg-surface-2">
            Not now
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!event) return;
              await event.prompt();
              const { outcome } = await event.userChoice;
              if (outcome === "dismissed") rememberDismiss(dismissKey);
              setEvent(null);
              setOpen(false);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white shadow-sm hover:bg-navy-deep"
          >
            <Download className="size-4" aria-hidden /> Install
          </button>
        </div>
      )}
    </div>
  );
}
