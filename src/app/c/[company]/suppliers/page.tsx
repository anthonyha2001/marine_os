import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { listSuppliers } from "@/lib/data/inventory";
import { PageHeader, cardClass } from "@/components/ui";
import { SupplierForm } from "./supplier-form";

async function SuppliersContent({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { slug } = await requireModule(company, "suppliers");
  const suppliers = await listSuppliers();

  return (
    <>
      <PageHeader title="Suppliers" description="Suppliers are shared by both companies." />

      <div className="mt-8 grid gap-8 xl:grid-cols-[22rem_1fr]">
        <section className={`${cardClass} h-fit p-5`}>
          <h2 className="mb-4 font-semibold text-navy">Add a supplier</h2>
          <SupplierForm companySlug={slug} />
        </section>

        <section className={`${cardClass} divide-y divide-border`}>
          {suppliers.length === 0 && <p className="p-10 text-center text-muted">No suppliers yet.</p>}
          {suppliers.map((s) => (
            <details key={s.id} className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-background/60">
                <span>
                  <span className="block font-medium text-navy">{s.name}</span>
                  <span className="block text-xs text-muted">
                    {[s.accountNumber && `Account ${s.accountNumber}`, s.phone, s.email].filter(Boolean).join(" · ") ||
                      "No details"}
                  </span>
                </span>
                <span className="text-xs font-medium text-brand group-open:hidden">Edit</span>
                <span className="hidden text-xs font-medium text-muted group-open:inline">Close</span>
              </summary>
              <div className="border-t border-border bg-background/40 p-5">
                <SupplierForm companySlug={slug} supplier={s} />
              </div>
            </details>
          ))}
        </section>
      </div>
    </>
  );
}

export default function SuppliersPage({ params }: PageProps<"/c/[company]/suppliers">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <SuppliersContent params={params} />
    </Suspense>
  );
}
