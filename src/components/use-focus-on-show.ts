"use client";

import { useEffect, useRef } from "react";

/**
 * Focus an input every time its page is shown. Plain autoFocus only fires on the first
 * mount, but Next keeps visited pages alive in the background and re-shows them;
 * effects re-run when that happens, so this works on every visit.
 */
export function useFocusOnShow<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);
  return ref;
}
