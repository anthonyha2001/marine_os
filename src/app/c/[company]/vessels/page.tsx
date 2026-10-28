import { Suspense } from "react";
import Link from "next/link";
import { Plus, Sailboat } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { listVessels } from "@/lib/data/vessels";
import { listCustomers } from "@/lib/data/sales";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { ButtonLink, EmptyState, PageHeader, SearchBar, cardClass, tdClass, thClass } from "@/components/ui";
import { VesselForm } from "./vessel-form";

type Search = { q?: string; new?: string; customer?: string };

async function VesselsContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "customers");
  const base = `/c/${slug}/vessels`;
  const [vessels, customers] = await Promise.all([listVessels(), search.new ? listCustomers() : []]);
  const needle = (search.q ?? "").trim().toLowerCase();
  const shown = vessels.filter(
    (v) =>
      !needle ||
      [v.name, v.customer?.name ?? "", v.make ?? "", v.model ?? "", v.registration ?? "", v.hullNumber ?? "", ...v.engines.map((e) => e.serialNumber ?? "")].some((t) =>
        t.toLowerCase().includes(needle),
      ),
  );

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Vessels"
        description="Customers' boats with their engines. Open one to see its full history: job cards, offers, invoices and warranties."
        action={<ButtonLink icon={Plus} href={`${base}?new=1`}>New vessel</ButtonLink>}
      />
      <div className="mt-6">
        <SearchBar action={base} defaultValue={search.q} placeholder="Search by name, owner, model, registration or engine serial no." />
      </div>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {shown.length === 0 ? (
          <EmptyState icon={Sailboat} title={needle ? "No vessel matches this search" : "No vessels yet"} description="Add your customers' boats to keep their service history in one place." />
        ) : (
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Vessel</th>
                <th className={thClass}>Owner</th>
                <th className={thClass}>Type</th>
                <th className={thClass}>Engines</th>
                <th className={thClass}>Home port</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((v) => (
                <tr key={v.id} className={`hover:bg-surface-2/60 ${v.active ? "" : "opacity-50"}`}>
                  <td className={tdClass}>
                    <Link href={`${base}/${v.id}`} className="font-medium text-brand hover:underline">
                      {v.name}
                    </Link>
                    <span className="block text-xs text-muted">{[v.make, v.model, v.lengthM ? `${v.lengthM} m` : null, v.year].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className={`${tdClass} text-navy`}>{v.customer?.name ?? "—"}</td>
                  <td className={`${tdClass} text-muted`}>{v.type ?? "—"}</td>
                  <td className={`${tdClass} text-muted`}>
                    {v.engines.length ? v.engines.map((e) => `${e.position}: ${[e.make, e.model].filter(Boolean).join(" ") || "—"}`).join(" · ") : "—"}
                  </td>
                  <td className={`${tdClass} text-muted`}>{v.homePort ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {search.new && (
        <Modal title="New vessel" closeHref={base} size="xl">
          <VesselForm key={crypto.randomUUID()} companySlug={slug} customers={customers.map((c) => ({ id: c.id, name: c.name }))} defaultCustomerId={search.customer} />
        </Modal>
      )}
    </>
  );
}

export default function VesselsPage({ params, searchParams }: PageProps<"/c/[company]/vessels">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading vessels…</p>}>
      <VesselsContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
