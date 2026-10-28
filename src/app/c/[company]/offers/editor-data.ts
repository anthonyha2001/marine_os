import "server-only";
import { getCatalogue } from "@/lib/data/inventory";
import { getCompanyProfile, listCustomers } from "@/lib/data/sales";
import { vesselOptions } from "@/lib/data/vessels";
import { DEFAULT_INTRO, DEFAULT_TERMS } from "@/lib/offers";
import type { CompanySlug } from "@/lib/permissions";
import type { CatalogueOption, CustomerOption } from "./offer-editor";

const SERVICE_UNIT_SHORT = { HOUR: "hr", FIXED: "lot", DAY: "day", UNIT: "unit" } as const;

/** Everything the offer editor needs besides the offer itself. */
export async function offerEditorData(slug: CompanySlug) {
  const [catalogue, customers, company, vessels] = await Promise.all([getCatalogue(), listCustomers(), getCompanyProfile(slug), vesselOptions()]);

  const options: CatalogueOption[] = catalogue
    .filter((c) => c.active)
    .map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description,
      type: c.type,
      unit: c.type === "SERVICE" && c.unit ? SERVICE_UNIT_SHORT[c.unit] : "pc",
      priceHT: c.priceHT,
      barcodes: c.barcodes,
    }));

  const customerOptions: CustomerOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    address: c.address,
  }));

  return {
    catalogue: options,
    customers: customerOptions,
    company,
    vessels: vessels.map((v) => ({ id: v.id, customerId: v.customerId, label: v.label })),
    defaultIntro: DEFAULT_INTRO,
    defaultTerms: company.offerTerms || DEFAULT_TERMS,
  };
}
