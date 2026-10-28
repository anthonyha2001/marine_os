"use client";

import { useActionState } from "react";
import { saveCompanyProfile, type CompanyFormState } from "@/lib/actions/settings";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton } from "@/components/ui";

type Profile = {
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxNumber: string | null;
  registrationNumber: string | null;
  bankDetails: string | null;
  offerTerms: string | null;
  labourCostPerHour: number;
};

export function CompanyForm({ companySlug, profile, defaultTerms }: { companySlug: string; profile: Profile; defaultTerms: string }) {
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(
    saveCompanyProfile.bind(null, companySlug),
    {},
  );

  return (
    <form action={formAction} data-save-shortcut className="mt-6 max-w-3xl space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <label className={labelClass}>
        Legal name (as printed on documents)
        <input name="legalName" defaultValue={profile.legalName ?? ""} placeholder={profile.name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Address (one line per row)
        <textarea name="address" rows={3} defaultValue={profile.address ?? ""} className={inputClass} />
      </label>
      <div className="grid gap-5 sm:grid-cols-3">
        <label className={labelClass}>
          Phone
          <input name="phone" defaultValue={profile.phone ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Email
          <input name="email" type="email" defaultValue={profile.email ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Website
          <input name="website" defaultValue={profile.website ?? ""} className={inputClass} />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          VAT / MOF number
          <input name="taxNumber" defaultValue={profile.taxNumber ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Commercial register (C.R.) number
          <input name="registrationNumber" defaultValue={profile.registrationNumber ?? ""} className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        Bank details (printed on offers; one line per row)
        <textarea
          name="bankDetails"
          rows={3}
          defaultValue={profile.bankDetails ?? ""}
          placeholder={"Bank: …\nAccount name: …\nIBAN: …   SWIFT: …"}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Default terms and conditions for new offers (one per line)
        <textarea name="offerTerms" rows={7} defaultValue={profile.offerTerms ?? defaultTerms} className={inputClass} />
      </label>
      <label className={labelClass}>
        Workshop labour cost per hour (USD) — what an hour of a technician costs the company, for job profit
        <input name="labourCostPerHour" type="number" min="0" step="0.01" defaultValue={profile.labourCostPerHour} className={`${inputClass} max-w-xs`} />
      </label>
      <FormMessage error={state.error} success={state.success} />
      <button type="submit" disabled={pending} className={`${primaryButton} gap-2`}>
        {pending ? "Saving…" : "Save company details"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}
