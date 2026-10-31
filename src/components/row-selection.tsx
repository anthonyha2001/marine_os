"use client";

import { createContext, useContext, useEffect, useState } from "react";

/*
 * Select rows of a list by clicking them (no checkboxes): click = this row, Ctrl+click = add or
 * remove one, Shift+click = a range, Ctrl+A = all, Esc = none. Double-click still opens a row.
 * The list's action bar reads the selection from this context.
 */

type Selection = {
  selected: string[];
  pick: (id: string, e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

export const useRowSelection = () => useContext(SelectionContext);

function isTyping(el: Element | null) {
  return !!el && ((el as HTMLElement).isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** `ids` are the rows in the order shown (for Shift+click ranges and Ctrl+A). */
export function RowSelection({ ids, children }: { ids: string[]; children: React.ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  // Rows that left the list (search, filter) leave the selection too.
  const shown = selected.filter((id) => ids.includes(id));

  const pick: Selection["pick"] = (id, e) => {
    if (e.shiftKey && anchor && ids.includes(anchor)) {
      const [a, b] = [ids.indexOf(anchor), ids.indexOf(id)].sort((x, y) => x - y);
      const range = ids.slice(a, b + 1);
      setSelected((s) => [...new Set([...(e.ctrlKey || e.metaKey ? s : []), ...range])]);
      return;
    }
    setAnchor(id);
    if (e.ctrlKey || e.metaKey) setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    else setSelected((s) => (s.length === 1 && s[0] === id ? [] : [id]));
  };
  const clear = () => setSelected([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(document.activeElement) || document.querySelector("[role=dialog]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(ids);
      } else if (e.key === "Escape") setSelected([]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids]);

  return <SelectionContext.Provider value={{ selected: shown, pick, clear }}>{children}</SelectionContext.Provider>;
}
