import { Suspense } from "react";
import { requireModule } from "@/lib/auth";
import { listCreditableInvoices } from "@/lib/data/ledger";
import { COMPANIES } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { CreditNoteForm } from "../credit-note-form";

async function NewCreditNote({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ invoice?: string }> }) {
  const [{ company }, { invoice }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "invoices");
  const invoices = await listCreditableInvoices(slug);
  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Sales`}
        title="New credit note"
        description="Reduces what the customer owes on an invoice (returns, price corrections, discounts). VAT follows the invoice."
      />
      <div className="mt-6">
        <CreditNoteForm key={crypto.randomUUID()} companySlug={slug} invoices={invoices} initialInvoiceId={invoice} />
      </div>
    </>
  );
}

export default function NewCreditNotePage({ params, searchParams }: PageProps<"/c/[company]/finance/credit-notes/new">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewCreditNote params={params} searchParams={searchParams as Promise<{ invoice?: string }>} />
    </Suspense>
  );
}
