"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveSupplier, type SupplierFormState } from "@/lib/actions/suppliers";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, inputClass, labelClass, primaryButton } from "@/components/ui";

type SupplierInput = {
  id: string;
  name: string;
  accountNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export function SupplierForm({ companySlug, supplier }: { companySlug: string; supplier?: SupplierInput }) {
  const [state, formAction, pending] = useActionState<SupplierFormState, FormData>(
    saveSupplier.bind(null, companySlug, supplier?.id ?? null),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const nameInput = useFocusOnShow<HTMLInputElement>(!supplier);

  useEffect(() => {
    if (state.success && !supplier) formRef.current?.reset();
  }, [state, supplier]);

  return (
    <form ref={formRef} action={formAction} data-save-shortcut={supplier ? undefined : true} className="space-y-4">
      <label className={labelClass}>
        Name *
        <input ref={nameInput} name="name" required defaultValue={supplier?.name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Account number
        <input name="accountNumber" defaultValue={supplier?.accountNumber ?? ""} className={inputClass} placeholder="Supplier account / reference" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Phone
          <input name="phone" defaultValue={supplier?.phone ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Email
          <input name="email" type="email" defaultValue={supplier?.email ?? ""} className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        Address
        <input name="address" defaultValue={supplier?.address ?? ""} className={inputClass} />
      </label>
      <label className={labelClass}>
        Notes
        <textarea name="notes" rows={2} defaultValue={supplier?.notes ?? ""} className={inputClass} />
      </label>
      <FormMessage error={state.error} success={state.success} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Saving…" : supplier ? "Save changes" : "Add supplier  (Ctrl S)"}
      </button>
    </form>
  );
}
