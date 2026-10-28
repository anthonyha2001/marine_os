"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveService, type ServiceFormState } from "@/lib/actions/services";
import { SERVICE_UNITS, type ServiceUnit } from "@/lib/catalogue";
import { formatMoney, withVat, VAT_RATE } from "@/lib/money";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButton } from "@/components/ui";

type ServiceInput = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: ServiceUnit | null;
  priceHT: number;
};

export function ServiceForm({ companySlug, service }: { companySlug: string; service?: ServiceInput }) {
  const [price, setPrice] = useState(service ? String(service.priceHT) : "");
  const [dirty, setDirty] = useState(false);
  const nameInput = useFocusOnShow<HTMLInputElement>(!service);
  const [state, formAction, pending] = useActionState<ServiceFormState, FormData>(
    saveService.bind(null, companySlug, service?.id ?? null),
    {},
  );

  const priceNumber = Number(price);
  const ttc = price !== "" && Number.isFinite(priceNumber) ? withVat(priceNumber) : null;

  return (
    <form
      action={formAction}
      data-save-shortcut
      data-dirty={dirty}
      onInput={() => setDirty(true)}
      className="mt-6 max-w-3xl space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <label className={labelClass}>
          Service name *
          <input ref={nameInput} name="name" required defaultValue={service?.name} className={inputClass} />
        </label>
        <div>
          <p className={labelClass}>Code</p>
          <p className="mt-1 rounded-lg bg-background px-3 py-2 font-mono text-sm text-muted">
            {service?.code ?? "Automatic"}
          </p>
        </div>
      </div>

      <label className={labelClass}>
        Description
        <textarea name="description" rows={3} defaultValue={service?.description ?? ""} className={inputClass} />
      </label>

      <div className="grid gap-5 sm:grid-cols-3">
        <label className={labelClass}>
          Charged *
          <select name="unit" required defaultValue={service?.unit ?? "HOUR"} className={inputClass}>
            {Object.entries(SERVICE_UNITS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Price excl. VAT *
          <input
            name="priceHT"
            type="number"
            step="0.01"
            min="0"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
          />
        </label>
        <div>
          <p className={labelClass}>Price TTC (+{VAT_RATE * 100}%)</p>
          <p className="mt-1 rounded-lg bg-background px-3 py-2 text-sm font-semibold text-navy">
            {ttc === null ? "—" : formatMoney(ttc)}
          </p>
        </div>
      </div>

      <FormMessage error={state.error} />

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={`${primaryButton} gap-2`}>
          {pending ? "Saving…" : service ? "Save changes" : "Create service"}
          <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
        {!service && (
          <button type="submit" name="intent" value="new" data-save-new disabled={pending} className={`${secondaryButton} gap-2`}>
            Save &amp; add another <Kbd>Ctrl Shift S</Kbd>
          </button>
        )}
        <Link href={`/c/${companySlug}/services`} className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
