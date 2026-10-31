import { withParams } from "@/lib/url";

/**
 * Where a form saved in a pop-up goes back to: the page it was opened on (a page of this
 * company only), with `done` set so the page shows a "saved" message. Null: the form's usual page.
 */
export function returnTarget(slug: string, formData: FormData | undefined, message: string) {
  const to = formData?.get("returnTo");
  return typeof to === "string" && to.startsWith(`/c/${slug}/`) ? withParams(to, { done: message }) : null;
}
