"use client";

import { SaveNewButton } from "@/components/save-new-button";
import { useActionState, useEffect, useRef } from "react";
import { saveCustomer, type CustomerFormState } from "@/lib/actions/customers";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, inputClass, labelClass, primaryButton } from "@/components/ui";

type CustomerInput = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  pdfLanguage?: string;
  notes: string | null;
};

export function CustomerForm({ companySlug, customer }: { companySlug: string; customer?: CustomerInput }) {
  const [state, formAction, pending] = useActionState<CustomerFormState, FormData>(
    saveCustomer.bind(null, companySlug, customer?.id ?? null),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const nameInput = useFocusOnShow<HTMLInputElement>(!customer);

  useEffect(() => {
    if (state.success && !customer) formRef.current?.reset();
  }, [state, customer]);

  return (
    <form ref={formRef} action={formAction} data-save-shortcut={customer ? undefined : true} className="space-y-4">
      <label className={labelClass}>
        Company / organisation *
        <input ref={nameInput} name="name" required defaultValue={customer?.name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Contact person
        <input name="contactName" defaultValue={customer?.contactName ?? ""} className={inputClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Phone
          <input name="phone" defaultValue={customer?.phone ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Email
          <input name="email" type="email" defaultValue={customer?.email ?? ""} className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        Address
        <textarea name="address" rows={2} defaultValue={customer?.address ?? ""} className={inputClass} />
      </label>
      <label className={labelClass}>
        VAT / tax number
        <input name="taxNumber" defaultValue={customer?.taxNumber ?? ""} className={inputClass} />
      </label>
      <label className={labelClass}>
        Documents language (offers and invoices)
        <select name="pdfLanguage" defaultValue={customer?.pdfLanguage ?? "EN"} className={inputClass}>
          <option value="EN">English</option>
          <option value="EN_AR">English + Arabic (عربي)</option>
        </select>
      </label>
      <label className={labelClass}>
        Notes
        <textarea name="notes" rows={2} defaultValue={customer?.notes ?? ""} className={inputClass} />
      </label>
      <FormMessage error={state.error} success={state.success} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`${primaryButton} flex-1`}>
          {pending ? "Saving…" : customer ? "Save changes" : "Add customer  (Ctrl S)"}
        </button>
        {!customer && <SaveNewButton disabled={pending} />}
      </div>
    </form>
  );
}
