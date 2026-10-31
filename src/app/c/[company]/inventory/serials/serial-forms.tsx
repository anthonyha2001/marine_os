"use client";

import { useActionState, useState, useTransition } from "react";
import { PackageCheck, RotateCcw, Trash2, XCircle } from "lucide-react";
import { deleteSerial, markSerialSold, registerSerials, setSerialStatus, type SerialFormState } from "@/lib/actions/serials";
import type { VesselOption } from "@/lib/data/vessels";
import { today } from "@/lib/dates";
import { useFeedback } from "@/components/feedback";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

export function RegisterSerialsForm({
  companySlug,
  products,
  purchases,
  defaults,
  returnTo,
}: {
  companySlug: string;
  products: { id: string; label: string }[];
  purchases: { id: string; label: string; productIds: string[] }[];
  defaults: { productId?: string; purchaseId?: string };
  returnTo?: string; // opened in a pop-up: come back to this page after saving
}) {
  const [state, formAction, pending] = useActionState<SerialFormState, FormData>(registerSerials.bind(null, companySlug), {});
  const [productId, setProductId] = useState(defaults.productId ?? products[0]?.id ?? "");
  const area = useFocusOnShow<HTMLTextAreaElement>();
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {products.length === 0 ? (
        <p className="rounded-lg bg-background p-3 text-sm text-muted">No product tracks serial numbers yet. Edit a product (e.g. an engine) and tick “Track serial numbers”.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Product *
              <select name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              From purchase
              <select name="purchaseId" defaultValue={defaults.purchaseId ?? ""} className={inputClass}>
                <option value="">— Not linked —</option>
                {purchases
                  .filter((p) => p.productIds.includes(productId))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label className={labelClass}>
            Serial numbers * (one per line, or scan them one after the other)
            <textarea ref={area} name="serials" rows={6} className={`${inputClass} font-mono`} />
          </label>
        </>
      )}
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending || !products.length} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Register"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

export function SellSerialForm({
  companySlug,
  serialId,
  serialNumber,
  customers,
  vessels,
}: {
  companySlug: string;
  serialId: string;
  serialNumber: string;
  customers: { id: string; name: string }[];
  vessels: VesselOption[];
}) {
  const [state, formAction, pending] = useActionState<SerialFormState, FormData>(markSerialSold.bind(null, companySlug, serialId), {});
  const [customerId, setCustomerId] = useState("");
  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      <input type="hidden" name="serialNumber" value={serialNumber} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Customer *
          <select name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
            <option value="">— Not saved: type the name —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {!customerId && (
          <label className={labelClass}>
            Customer name *
            <input name="customerName" maxLength={200} className={inputClass} />
          </label>
        )}
        <label className={labelClass}>
          Fitted on vessel
          <select name="vesselId" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {vessels
              .filter((v) => !customerId || v.customerId === customerId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
          </select>
        </label>
        <label className={labelClass}>
          Sold on *
          <input name="soldAt" type="date" required defaultValue={today()} className={inputClass} />
        </label>
        <label className={labelClass}>
          Invoice / job card / sale no.
          <input name="soldRef" maxLength={60} placeholder="e.g. XM-INV-2026-0012" className={inputClass} />
        </label>
      </div>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Mark as sold"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

export function SerialActions({ companySlug, serialId, serialNumber, status }: { companySlug: string; serialId: string; serialNumber: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else toast.success(ok);
    });
  const btn = "inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-navy";
  return (
    <span className="inline-flex">
      {status === "SOLD" && (
        <button type="button" disabled={pending} title="Returned by the customer" aria-label={`Returned: ${serialNumber}`} className={btn} onClick={() => run(() => setSerialStatus(companySlug, serialId, "RETURNED"), "Marked as returned.")}>
          <RotateCcw className="size-4" aria-hidden />
        </button>
      )}
      {(status === "RETURNED" || status === "SCRAPPED") && (
        <button type="button" disabled={pending} title="Back in stock" aria-label={`Back in stock: ${serialNumber}`} className={btn} onClick={() => run(() => setSerialStatus(companySlug, serialId, "IN_STOCK"), "Back in stock.")}>
          <PackageCheck className="size-4" aria-hidden />
        </button>
      )}
      {status !== "SCRAPPED" && status !== "SOLD" && (
        <button
          type="button"
          disabled={pending}
          title="Scrapped / written off"
          aria-label={`Scrap ${serialNumber}`}
          className={btn}
          onClick={async () => {
            if (await confirm({ title: `Scrap ${serialNumber}?`, message: "The unit is marked as written off.", confirmLabel: "Scrap", tone: "danger" })) run(() => setSerialStatus(companySlug, serialId, "SCRAPPED"), "Marked as scrapped.");
          }}
        >
          <XCircle className="size-4" aria-hidden />
        </button>
      )}
      {status === "IN_STOCK" && (
        <button
          type="button"
          disabled={pending}
          title="Delete (entered by mistake)"
          aria-label={`Delete ${serialNumber}`}
          className={`${btn} hover:text-danger`}
          onClick={async () => {
            if (await confirm({ title: `Delete ${serialNumber}?`, message: "Use this only for a serial number entered by mistake.", confirmLabel: "Delete", tone: "danger" })) run(() => deleteSerial(companySlug, serialId), "Deleted.");
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </span>
  );
}
