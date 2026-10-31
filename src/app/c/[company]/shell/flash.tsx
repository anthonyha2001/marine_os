"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFeedback } from "@/components/feedback";

/** After a pop-up saves and closes, the page gets ?done=<message>: show it once, then tidy the address. */
export function Flash() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useFeedback();
  const message = params.get("done");
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!message) {
      shown.current = null;
      return;
    }
    if (shown.current !== message) toast.success(message);
    shown.current = message;
    const rest = new URLSearchParams(params.toString());
    rest.delete("done");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [message, params, pathname, router, toast]);

  return null;
}
