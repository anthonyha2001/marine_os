"use client";

import { useEffect, useRef } from "react";
import { Kbd, secondaryButton } from "@/components/ui";

/**
 * "Save & new" (Ctrl+Shift+S): saves the form, then the same empty form opens again on the
 * same page. It sends intent=new plus the page's address ("again"), read by againTarget().
 */
export function SaveNewButton({ disabled, className = "" }: { disabled?: boolean; className?: string }) {
  const again = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Set on every submit (also Ctrl+Shift+S, which doesn't click the button).
    const form = again.current?.form;
    const set = () => {
      if (again.current) again.current.value = window.location.pathname + window.location.search;
    };
    form?.addEventListener("submit", set, true);
    return () => form?.removeEventListener("submit", set, true);
  }, []);
  return (
    <>
      <input ref={again} type="hidden" name="again" />
      <button type="submit" name="intent" value="new" data-save-new disabled={disabled} className={`${secondaryButton} gap-2 ${className}`}>
        Save &amp; new <Kbd>Ctrl Shift S</Kbd>
      </button>
    </>
  );
}
