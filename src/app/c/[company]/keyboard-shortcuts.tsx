"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { activePage, matchesShortcut, visibleNav, type NavGroup } from "@/lib/navigation";
import { useFeedback } from "@/components/feedback";
import { Kbd } from "@/components/ui";

/*
 * Global shortcuts for the company workspace.
 *   screen shortcuts   any `shortcut` set in src/lib/navigation.ts (none for now)
 *   Ctrl + ← / →   previous / next tab of the section (the tabs at the top of the page)
 *   Ctrl + N, Alt + N   create: the page's own "new" form, or the "+ New" menu
 *   Ctrl+S         save the form marked data-save-shortcut
 *   Ctrl+Shift+S   "save & add another" (button marked data-save-new)
 *   /              focus the search box marked data-shortcut-search
 *   ?              show this list
 * A form marked data-dirty="true" asks before a shortcut navigates away from it.
 */

const FORM_SHORTCUTS: [string, string][] = [
  ["Ctrl + S", "Save the current form"],
  ["Ctrl + Shift + S", "Save and start a new one (products, services)"],
  ["Ctrl + P", "Open the PDF (on an offer or invoice)"],
  ["Enter", "Add a scanned barcode / product (on the scan fields)"],
  ["↑ ↓", "Choose a product in the purchase search list"],
  ["Ctrl + K", "Search everything / go to a page"],
  ["Ctrl + N  (or Alt + N)", "Create something new"],
  ["Ctrl + ← / →", "Previous / next tab"],
  ["↑ ↓ then Enter", "Pick a row in a list and open it"],
  ["/", "Jump to the search box on the page"],
  ["?", "Show this list"],
  ["Esc", "Close this list / leave a field"],
];

/**
 * First matching element on the page the user is looking at. Next keeps visited pages
 * alive but hidden, so a plain querySelector could pick a form on a hidden page.
 */
function visible<T extends Element>(selector: string) {
  // An open pop-up takes priority over the page behind it (whose form is visible too).
  const dialogs = [...document.querySelectorAll<HTMLElement>("[role=dialog]")].filter((d) => d.checkVisibility());
  const scope: ParentNode = dialogs.at(-1) ?? document;
  return [...scope.querySelectorAll<T>(selector)].find((el) => el.checkVisibility()) ?? null;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export function KeyboardShortcuts({ base, groups }: { base: string; groups: NavGroup[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const { confirm } = useFeedback();
  const items = useMemo(() => groups.flatMap((g) => g.items).filter((i) => i.shortcut), [groups]);

  useEffect(() => {
    // Warm up every shortcut target so the jump is instant.
    for (const item of items) router.prefetch(`${base}/${item.path}`);
  }, [router, base, items]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key.toLowerCase() === "s") {
        e.preventDefault(); // never open the browser's "Save page" dialog
        const form = visible<HTMLFormElement>("form[data-save-shortcut]");
        if (!form) return;
        const saveNew = e.shiftKey ? form.querySelector<HTMLButtonElement>("button[data-save-new]") : null;
        form.requestSubmit(saveNew ?? undefined);
        return;
      }

      // Leave without saving? Asked before any shortcut moves away from a form being edited.
      const go = (target: string) => {
        if (!visible("form[data-dirty='true']")) return router.push(target);
        void confirm({ title: "Leave without saving?", message: "You have unsaved changes on this page.", confirmLabel: "Leave", tone: "danger" }).then(
          (ok) => ok && router.push(target),
        );
      };
      const current = activePage(visibleNav(groups), base, pathname);

      if (ctrl && !e.shiftKey && !e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !isTyping(e.target)) {
        if (!current) return;
        const tabs = current.group.items.map((i) => `${base}/${i.path}`);
        const next = tabs[tabs.indexOf(current.href) + (e.key === "ArrowRight" ? 1 : -1)];
        e.preventDefault();
        if (next) go(next);
        return;
      }

      if (e.key.toLowerCase() === "n" && !e.shiftKey && ctrl !== e.altKey) {
        e.preventDefault(); // a browser tab may still open a new window on Ctrl+N; Alt+N always works
        // The page's own "new" (Offers → New offer); the section is looked up in the full list, where the create items are.
        const page = current?.href.slice(base.length + 1);
        const own = page
          ? (groups.find((g) => g.title === current?.group.title)?.items ?? []).filter(
              (i) => i.create && (i.path.startsWith(`${page}/`) || i.path.startsWith(`${page}?`)),
            )
          : [];
        if (own.length === 1) go(`${base}/${own[0].path}`);
        else {
          window.dispatchEvent(new Event("marine:new"));
          // Pick the first entry so ↑ / ↓ and Enter work straight away.
          setTimeout(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })), 60);
        }
        return;
      }

      const item = !ctrl && !e.altKey ? items.find((i) => matchesShortcut(i.shortcut!, e)) : undefined;
      if (item) {
        e.preventDefault();
        go(`${base}/${item.path}`);
        return;
      }

      if (e.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        else if (isTyping(e.target)) (e.target as HTMLElement).blur();
        return;
      }

      if (isTyping(e.target) || ctrl || e.altKey) return;

      if (e.key === "/") {
        const search = visible<HTMLInputElement>("[data-shortcut-search]");
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((open) => !open);
      }
    }

    // The sidebar and the user menu open this list with a "marine:shortcuts" event.
    const onOpen = () => setHelpOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("marine:shortcuts", onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("marine:shortcuts", onOpen);
    };
  }, [items, groups, base, pathname, router, helpOpen, confirm]);

  return (
    <>
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/40 p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-navy">Keyboard shortcuts</h2>
              <button type="button" onClick={() => setHelpOpen(false)} className="text-muted hover:text-navy" aria-label="Close">
                ×
              </button>
            </div>

            {items.length > 0 && (
              <>
                <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">Go to</h3>
                <ul className="mt-2 divide-y divide-border">
                  {items.map((i) => (
                    <li key={i.path} className="flex items-center justify-between py-2 text-sm">
                      {i.label}
                      <Kbd className="text-xs">{i.shortcut}</Kbd>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">On forms</h3>
            <ul className="mt-2 divide-y divide-border">
              {FORM_SHORTCUTS.map(([keys, label]) => (
                <li key={keys} className="flex items-center justify-between gap-4 py-2 text-sm">
                  {label}
                  <Kbd className="whitespace-nowrap text-xs">{keys}</Kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
