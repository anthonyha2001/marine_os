import { withParams } from "@/lib/url";

/**
 * Where a form saved in a pop-up goes back to: the page it was opened on (a page of this
 * company only), with `done` set so the page shows a "saved" message. Null: the form's usual page.
 */
export function returnTarget(slug: string, formData: FormData | undefined, message: string) {
  const to = formData?.get("returnTo");
  return typeof to === "string" && to.startsWith(`/c/${slug}/`) ? withParams(to, { done: message }) : null;
}

/** "Save & new": the same page again (so the same empty form reopens), with the "saved" message. */
export function againTarget(slug: string, formData: FormData | undefined, message: string) {
  if (formData?.get("intent") !== "new") return null;
  const to = formData.get("again");
  return typeof to === "string" && to.startsWith(`/c/${slug}/`) ? withParams(to, { done: message }) : null;
}

/** True when the form was sent with "Save & new". */
export const wantsAnother = (formData: FormData | undefined) => formData?.get("intent") === "new";
