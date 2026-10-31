"use client";

import { useEffect } from "react";

/*
 * Enter moves to the next field (Shift+Enter to the previous one), everywhere in the app.
 *  - On the last field of a form, Enter saves it as before (forms marked data-enter-no-submit never
 *    save on Enter: big editors where a scanner's Enter must not post the document).
 *  - A form with a single field (search bars, scan boxes) keeps its normal Enter.
 *  - Fields that use Enter themselves (scan boxes, pick lists) call preventDefault and are left alone,
 *    as are text areas (new line), buttons and links.
 */

const FIELDS = 'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]):not([type=file]):not([type=image]), select, textarea';

function fieldsIn(scope: ParentNode) {
  const seenRadio = new Set<string>();
  return [...scope.querySelectorAll<HTMLElement>(FIELDS)].filter((el) => {
    const f = el as HTMLInputElement;
    if (f.disabled || f.readOnly || el.tabIndex < 0 || !el.checkVisibility()) return false;
    // A radio group counts as one stop.
    if (f.type === "radio") {
      if (seenRadio.has(f.name)) return false;
      seenRadio.add(f.name);
    }
    return true;
  });
}

export function EnterKeys() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
      // Open pick lists (customer / product search) handle Enter themselves.
      if (el.getAttribute("aria-expanded") === "true") return;

      const form = el.closest("form");
      const scope: ParentNode | null = form ?? el.closest("[role=dialog]") ?? el.closest("main");
      if (!scope) return;
      const fields = fieldsIn(scope);
      if (form && fields.length <= 1) return; // search bar, scan box, one-field form: normal Enter

      const at = fields.indexOf(el);
      if (at < 0) return;
      const next = fields[at + (e.shiftKey ? -1 : 1)];
      e.preventDefault();
      if (next) {
        next.focus();
        if (next instanceof HTMLInputElement && ["text", "number", "email", "tel", "search", "url", ""].includes(next.type)) next.select();
        return;
      }
      // Last field: save, unless this form never saves on Enter.
      if (!e.shiftKey && form && !form.hasAttribute("data-enter-no-submit")) form.requestSubmit();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
