"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/*
 * ↑ / ↓ pick a row in the list on screen (table rows, or anything marked data-nav-row),
 * Enter opens it, Esc lets go. An open pop-up is used instead of the page behind it.
 */

function isTyping(el: Element | null) {
  return !!el && ((el as HTMLElement).isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function rows(): HTMLElement[] {
  const dialogs = [...document.querySelectorAll<HTMLElement>("[role=dialog]")].filter((d) => d.checkVisibility());
  // Next keeps visited pages alive but hidden: only look at what is on screen.
  const scope = dialogs.at(-1) ?? [...document.querySelectorAll<HTMLElement>("main")].find((m) => m.checkVisibility());
  if (!scope) return [];
  return [...scope.querySelectorAll<HTMLElement>("[data-nav-row], tbody tr")].filter(
    (el) => el.checkVisibility() && !el.closest("[data-no-row-keys]") && (el.matches("a[href], [data-open-href]") || !!el.querySelector("a[href]")),
  );
}

export function RowKeys() {
  const router = useRouter();
  const pathname = usePathname();
  const active = useRef<HTMLElement | null>(null);

  const select = (el: HTMLElement | null) => {
    active.current?.removeAttribute("data-row-active");
    active.current = el;
    if (el) {
      el.setAttribute("data-row-active", "");
      el.scrollIntoView({ block: "nearest" });
    }
  };

  // A new page starts with nothing picked.
  useEffect(() => () => select(null), [pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented || isTyping(document.activeElement)) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const list = rows();
        if (!list.length) return;
        e.preventDefault();
        const at = active.current ? list.indexOf(active.current) : -1;
        const next = at < 0 ? (e.key === "ArrowDown" ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
        select(list[next]);
      } else if (e.key === "Enter" && active.current?.isConnected && active.current.checkVisibility()) {
        // Enter on a focused button or link keeps doing its own job.
        const focus = document.activeElement;
        if (focus && focus !== document.body && focus !== active.current) return;
        e.preventDefault();
        const row = active.current;
        const href = row.dataset.openHref;
        if (href) router.replace(href, { scroll: false });
        else (row.matches("a[href]") ? row : row.querySelector<HTMLElement>("a[href]"))?.click();
      } else if (e.key === "Escape" && active.current) {
        select(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
