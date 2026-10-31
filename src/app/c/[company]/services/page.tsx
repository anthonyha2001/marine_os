import { Suspense } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { SERVICE_UNITS } from "@/lib/catalogue";
import { listServices } from "@/lib/data/inventory";
import { formatMoney, withVat } from "@/lib/money";
import { Modal } from "@/components/modal";
import { cardClass, PageHeader, ButtonLink, SavedNotice, SearchBar } from "@/components/ui";
import { ServiceForm } from "./service-form";

async function ServicesContent({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ q?: string; saved?: string; new?: string }>;
}) {
  const [{ company }, { q = "", saved, new: creating }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "services");
  const services = await listServices(q);
  const base = `/c/${slug}/services`;

  return (
    <>
      <PageHeader
        title="Services"
        description="Labour, repairs and other services. Shared by both companies; no stock is tracked."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New service</ButtonLink>}
      />

      {saved && !creating && <SavedNotice code={saved} label="Service" />}

      {creating && (
        <Modal title="New service" closeHref={base} size="lg">
          {saved && <SavedNotice code={saved} label="Service" />}
          {/* New key per open: an empty form every time, including after "save & add another". */}
          <ServiceForm key={crypto.randomUUID()} companySlug={slug} />
        </Modal>
      )}

      <div className="mt-6">
        <SearchBar action={base} defaultValue={q} placeholder="Search by name or 4-digit code" />
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {services.length === 0 ? (
          <p className="p-10 text-center text-muted">{q ? "No services match this search." : "No services yet. Use + New to add one."}</p>
        ) : (
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Charged</th>
                <th className="px-4 py-3 text-right">Price excl. VAT</th>
                <th className="px-4 py-3 text-right">Price TTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-background/60">
                  <td className="px-4 py-3">
                    <Link href={`${base}/${s.id}`} className="font-medium text-navy hover:underline">
                      {s.name}
                    </Link>
                    {s.description && <p className="max-w-md truncate text-xs text-muted">{s.description}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono">{s.code}</td>
                  <td className="px-4 py-3 text-muted">{s.unit ? SERVICE_UNITS[s.unit] : "—"}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(s.priceHT)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(withVat(s.priceHT))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function ServicesPage({ params, searchParams }: PageProps<"/c/[company]/services">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading services…</p>}>
      <ServicesContent params={params} searchParams={searchParams as Promise<{ q?: string; saved?: string; new?: string }>} />
    </Suspense>
  );
}
