"use client";

import { useActionState, useState, useTransition } from "react";
import { addWarrantyClaim, createWarranty, setClaimStatus, setWarrantyVoid, type WarrantyFormState } from "@/lib/actions/warranties";
import type { VesselOption } from "@/lib/data/vessels";
import { today } from "@/lib/dates";
import { useFeedback } from "@/components/feedback";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButtonSm } from "@/components/ui";

export type WarrantyPrefill = {
  customerId?: string | null;
  customerName?: string;
  vesselId?: string | null;
  sourceType?: string;
  sourceId?: string;
  sourceLabel?: string;
  items?: { title: string; productId: string | null }[];
};

export function NewWarrantyForm({
  companySlug,
  customers,
  vessels,
  prefill = {},
}: {
  companySlug: string;
  customers: { id: string; name: string }[];
  vessels: VesselOption[];
  prefill?: WarrantyPrefill;
}) {
  const [state, formAction, pending] = useActionState<WarrantyFormState, FormData>(createWarranty.bind(null, companySlug), {});
  const [customerId, setCustomerId] = useState(prefill.customerId ?? "");
  const [item, setItem] = useState(prefill.items?.[0]?.title ?? "");
  const productId = prefill.items?.find((i) => i.title === item)?.productId ?? "";
  const first = useFocusOnShow<HTMLInputElement>();

  return (
    <form action={formAction} data-save-shortcut className="space-y-4">
      {prefill.sourceLabel && (
        <p className="rounded-lg bg-background p-3 text-sm text-muted">
          From {prefill.sourceLabel}
          <input type="hidden" name="sourceType" value={prefill.sourceType} />
          <input type="hidden" name="sourceId" value={prefill.sourceId} />
          <input type="hidden" name="sourceLabel" value={prefill.sourceLabel} />
        </p>
      )}
      <input type="hidden" name="productId" value={productId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          What is covered *
          <input ref={first} name="item" required value={item} onChange={(e) => setItem(e.target.value)} list="warranty-items" maxLength={300} placeholder="e.g. Yamaha F150 outboard, propeller repair" className={inputClass} />
          <datalist id="warranty-items">
            {prefill.items?.map((i) => (
              <option key={i.title} value={i.title} />
            ))}
          </datalist>
        </label>
        <label className={labelClass}>
          Serial number
          <input name="serialNumber" maxLength={120} className={inputClass} />
        </label>
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
            <input name="customerName" defaultValue={prefill.customerName ?? ""} maxLength={200} className={inputClass} />
          </label>
        )}
        <label className={labelClass}>
          Vessel
          <select name="vesselId" defaultValue={prefill.vesselId ?? ""} className={inputClass}>
            <option value="">—</option>
            {vessels
              .filter((v) => !customerId || v.customerId === customerId || v.id === prefill.vesselId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
          </select>
        </label>
        <label className={labelClass}>
          Starts on *
          <input name="startDate" type="date" required defaultValue={today()} className={inputClass} />
        </label>
        <label className={labelClass}>
          Length (months) *
          <input name="months" type="number" min="1" max="240" required defaultValue="12" className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        Terms (printed on the certificate; leave empty for the standard text)
        <textarea name="terms" rows={3} maxLength={4000} className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Saving…" : "Add warranty"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

export function ClaimForm({ companySlug, warrantyId, jobCards }: { companySlug: string; warrantyId: string; jobCards: { id: string; number: string }[] }) {
  const [state, formAction, pending] = useActionState<WarrantyFormState, FormData>(addWarrantyClaim.bind(null, companySlug, warrantyId), {});
  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-semibold text-navy">New claim</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          Date *
          <input name="date" type="date" required defaultValue={today()} className={inputClass} />
        </label>
        <label className={labelClass}>
          Decision
          <select name="status" defaultValue="OPEN" className={inputClass}>
            <option value="OPEN">Open</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </label>
        <label className={labelClass}>
          Job card
          <select name="jobCardId" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {jobCards.map((j) => (
              <option key={j.id} value={j.id}>
                {j.number}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={labelClass}>
        Problem reported *
        <textarea name="description" required rows={2} maxLength={2000} className={inputClass} />
      </label>
      <label className={labelClass}>
        Resolution
        <textarea name="resolution" rows={2} maxLength={2000} className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Saving…" : "Record claim"}
      </button>
    </form>
  );
}

export function ClaimStatusSelect({ companySlug, claimId, status }: { companySlug: string; claimId: string; status: "OPEN" | "ACCEPTED" | "REJECTED" | "RESOLVED" }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useFeedback();
  return (
    <select
      disabled={pending}
      defaultValue={status}
      aria-label="Claim decision"
      onChange={(e) =>
        startTransition(async () => {
          const res = await setClaimStatus(companySlug, claimId, e.target.value as typeof status);
          if (res.error) toast.error(res.error);
          else toast.success("Claim updated.");
        })
      }
      className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
    >
      <option value="OPEN">Open</option>
      <option value="ACCEPTED">Accepted</option>
      <option value="REJECTED">Rejected</option>
      <option value="RESOLVED">Resolved</option>
    </select>
  );
}

export function VoidButton({ companySlug, warrantyId, voided }: { companySlug: string; warrantyId: string; voided: boolean }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  return (
    <button
      type="button"
      disabled={pending}
      className={secondaryButtonSm}
      onClick={async () => {
        if (!voided && !(await confirm({ title: "Void this warranty?", message: "It stays on file but no longer covers the item.", confirmLabel: "Void", tone: "danger" }))) return;
        startTransition(async () => {
          const res = await setWarrantyVoid(companySlug, warrantyId, !voided);
          if (res.error) toast.error(res.error);
          else toast.success(voided ? "Warranty restored." : "Warranty voided.");
        });
      }}
    >
      {voided ? "Restore" : "Void"}
    </button>
  );
}
