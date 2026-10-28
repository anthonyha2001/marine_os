"use client";

import { useActionState, useState } from "react";
import { createJobCard, saveJobCard, type WorkshopFormState } from "@/lib/actions/workshop";
import type { JobCardRow } from "@/lib/data/workshop";
import type { VesselOption } from "@/lib/data/vessels";
import { VAT_RATE, formatMoney, round2 } from "@/lib/money";
import { FreeLinesEditor, lineAmount, type CatalogueItem, type FreeLine } from "@/components/free-lines";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, StickyActions, cardClass, inputClass, labelClass, primaryButton } from "@/components/ui";

/** New or open job card: the boat, what was asked, what was done, parts and labour. */
export function JobCardForm({
  companySlug,
  job,
  vessels,
  customers,
  catalogue,
  defaults,
}: {
  companySlug: string;
  job?: JobCardRow;
  vessels: VesselOption[];
  customers: { id: string; name: string }[];
  catalogue: CatalogueItem[];
  defaults?: { vesselId?: string; customerId?: string };
}) {
  const action = job ? saveJobCard.bind(null, companySlug, job.id) : createJobCard.bind(null, companySlug);
  const [state, formAction, pending] = useActionState<WorkshopFormState, FormData>(action, {});
  const [vesselId, setVesselId] = useState(job?.vessel?.id ?? defaults?.vesselId ?? "");
  const [customerId, setCustomerId] = useState(job?.customerId ?? defaults?.customerId ?? vessels.find((v) => v.id === defaults?.vesselId)?.customerId ?? "");
  const [applyVat, setApplyVat] = useState(job?.applyVat ?? true);
  const [dirty, setDirty] = useState(false);
  const [lines, setLines] = useState<FreeLine[]>(() =>
    (job?.lines ?? []).map((l) => ({
      key: l.id,
      productId: l.productId,
      kind: l.kind,
      title: l.title,
      quantity: String(l.quantity),
      unitPrice: String(l.unitPrice),
      billable: l.billable,
      locked: !!l.invoice,
    })),
  );
  const first = useFocusOnShow<HTMLSelectElement>(!job);
  const fromOffer = !!job?.offer;
  const totalHT = round2(lines.reduce((s, l) => s + lineAmount(l), 0));
  const billHT = round2(lines.filter((l) => l.billable && !l.locked).reduce((s, l) => s + lineAmount(l), 0));
  const vat = applyVat ? round2(billHT * VAT_RATE) : 0;

  return (
    <form
      onChange={() => setDirty(true)}
      action={(fd) => {
        const f = (k: string) => String(fd.get(k) ?? "");
        fd.set(
          "payload",
          JSON.stringify({
            vesselId: vesselId || null,
            customerId: customerId || null,
            customerName: f("customerName"),
            complaint: f("complaint"),
            workDone: f("workDone"),
            technician: f("technician"),
            engineHours: f("engineHours"),
            dueDate: f("dueDate"),
            applyVat,
            lines: lines
              .filter((l) => l.title.trim())
              .map((l) => ({ id: l.locked ? l.key : undefined, kind: l.kind, productId: l.productId, title: l.title, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, billable: l.billable })),
          }),
        );
        return formAction(fd);
      }}
      data-save-shortcut
      data-dirty={dirty ? "true" : undefined}
      className="space-y-6"
    >
      <section className={`${cardClass} grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3`}>
        <label className={labelClass}>
          Vessel
          <select
            ref={first}
            value={vesselId}
            onChange={(e) => {
              setVesselId(e.target.value);
              const owner = vessels.find((v) => v.id === e.target.value)?.customerId;
              if (owner) setCustomerId(owner);
            }}
            className={inputClass}
          >
            <option value="">— No vessel —</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Customer *
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
            <option value="">— Not saved: type the name —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {!customerId ? (
          <label className={labelClass}>
            Customer name *
            <input name="customerName" defaultValue={job && !job.customerId ? job.customerName : ""} maxLength={200} className={inputClass} />
          </label>
        ) : (
          <div />
        )}
        <label className={labelClass}>
          Technician
          <input name="technician" defaultValue={job?.technician ?? ""} maxLength={120} placeholder="Who does the work" className={inputClass} />
        </label>
        <label className={labelClass}>
          Engine hours
          <input name="engineHours" type="number" min="0" defaultValue={job?.engineHours ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Promised for
          <input name="dueDate" type="date" defaultValue={job?.dueDate ? job.dueDate.toISOString().slice(0, 10) : ""} className={inputClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
          Work requested / problem reported *
          <textarea name="complaint" required rows={2} maxLength={4000} defaultValue={job?.complaint ?? ""} placeholder="e.g. Port engine overheating; 500 h service" className={inputClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
          Work done / findings
          <textarea name="workDone" rows={3} maxLength={8000} defaultValue={job?.workDone ?? ""} placeholder="What was found and what was done" className={inputClass} />
        </label>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="font-semibold text-navy">Parts and labour</h2>
        <p className="mt-1 text-sm text-muted">
          {fromOffer
            ? `Lines from offer ${job!.offer!.number} are already billed by the offer ("Bill" unticked). Add extra work with "Bill" ticked to invoice it from here.`
            : "Parts with a catalogue product leave the stock when the job is marked done."}
        </p>
        <div className="mt-3">
          <FreeLinesEditor
            lines={lines}
            onChange={(l) => {
              setDirty(true);
              setLines(l);
            }}
            catalogue={catalogue}
            withKind
            withBillable={fromOffer}
            listId="job-catalogue"
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} className="size-4 accent-brand" />
          Charge VAT {VAT_RATE * 100}% when invoiced
        </label>
      </section>

      <FormMessage error={state.error} />
      <StickyActions
        summary={
          <span>
            Work total {formatMoney(totalHT)} excl. VAT
            {fromOffer && (
              <>
                {" "}
                · <span className="font-semibold text-navy">extra to bill {formatMoney(round2(billHT + vat))}</span>
              </>
            )}
          </span>
        }
      >
        <button type="submit" disabled={pending} className={`${primaryButton} gap-2`}>
          {pending ? "Saving…" : job ? "Save job card" : "Open job card"}
          <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
      </StickyActions>
    </form>
  );
}
