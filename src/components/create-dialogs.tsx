import { dayFormat } from "@/lib/dates";
import { getCatalogue, listPurchases, listSuppliers, productCatalogue } from "@/lib/data/inventory";
import { listCreditableInvoices } from "@/lib/data/ledger";
import { getPurchaseOrder } from "@/lib/data/purchase-orders";
import { listCustomers } from "@/lib/data/sales";
import { vesselOptions } from "@/lib/data/vessels";
import { getJobCard } from "@/lib/data/workshop";
import { COMPANIES, type CompanySlug } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { OfferEditor } from "@/app/c/[company]/offers/offer-editor";
import { offerEditorData } from "@/app/c/[company]/offers/editor-data";
import { JobCardForm } from "@/app/c/[company]/workshop/job-card-form";
import { CreditNoteForm } from "@/app/c/[company]/finance/credit-notes/credit-note-form";
import { NewWarrantyForm, type WarrantyPrefill } from "@/app/c/[company]/warranties/warranty-forms";
import { RegisterSerialsForm } from "@/app/c/[company]/inventory/serials/serial-forms";
import { PurchaseForm } from "@/app/c/[company]/purchases/purchase-form";
import { VesselForm } from "@/app/c/[company]/vessels/vessel-form";
import { NewAppointmentForm } from "@/app/c/[company]/appointments/appointment-forms";
import { APPOINTMENT_SLOTS } from "@/lib/data/portal";
import { businessToday } from "@/lib/dates";
import { Modal } from "@/components/modal";
import { cardClass } from "@/components/ui";

/*
 * "New …" forms opened as pop-ups over the page you are on. Each saves and comes back to
 * `closeHref` with a "saved" message, so nothing jumps to another page.
 */

export async function NewOfferDialog({ slug, closeHref, customerId }: { slug: CompanySlug; closeHref: string; customerId?: string }) {
  const data = await offerEditorData(slug);
  return (
    <Modal title="New offer" closeHref={closeHref} size="full">
      <OfferEditor
        key={crypto.randomUUID()}
        companySlug={slug}
        companyName={data.company.legalName || COMPANIES[slug].name}
        catalogue={data.catalogue}
        customers={data.customers}
        vessels={data.vessels}
        clauses={data.clauses}
        defaultIntro={data.defaultIntro}
        defaultTerms={data.defaultTerms}
        defaultCustomerId={customerId}
        returnTo={closeHref}
      />
    </Modal>
  );
}

export async function NewJobCardDialog({ slug, closeHref, customerId, vesselId }: { slug: CompanySlug; closeHref: string; customerId?: string; vesselId?: string }) {
  const [vessels, customers, catalogue] = await Promise.all([vesselOptions(), listCustomers(), getCatalogue()]);
  return (
    <Modal title="New job card" closeHref={closeHref} size="xl">
      <JobCardForm
        key={crypto.randomUUID()}
        companySlug={slug}
        vessels={vessels}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        catalogue={catalogue.filter((c) => c.active).map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type, priceHT: c.priceHT }))}
        defaults={{ vesselId, customerId }}
        returnTo={closeHref}
      />
    </Modal>
  );
}

export async function CreditNoteDialog({ slug, closeHref, invoiceId }: { slug: CompanySlug; closeHref: string; invoiceId: string }) {
  const invoices = await listCreditableInvoices(slug);
  return (
    <Modal title="New credit note" closeHref={closeHref} size="xl">
      <CreditNoteForm key={crypto.randomUUID()} companySlug={slug} invoices={invoices} initialInvoiceId={invoiceId} returnTo={closeHref} />
    </Modal>
  );
}

export async function NewWarrantyDialog({ slug, closeHref, jobId }: { slug: CompanySlug; closeHref: string; jobId?: string }) {
  const [job, customers, vessels] = await Promise.all([jobId ? getJobCard(slug, jobId) : null, listCustomers(), vesselOptions()]);
  // From a job card: the customer, the boat and its parts are filled in.
  const prefill: WarrantyPrefill | undefined = job
    ? {
        customerId: job.customerId,
        customerName: job.customerName,
        vesselId: job.vessel?.id ?? null,
        sourceType: "JOB_CARD",
        sourceId: job.id,
        sourceLabel: job.number,
        items: job.lines.filter((l) => l.kind !== "LABOR").map((l) => ({ title: l.title, productId: l.productId })),
      }
    : undefined;
  return (
    <Modal title="New warranty" closeHref={closeHref} size="md">
      <NewWarrantyForm
        key={crypto.randomUUID()}
        companySlug={slug}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        vessels={vessels}
        prefill={prefill}
        returnTo={closeHref}
      />
    </Modal>
  );
}

export async function RegisterSerialsDialog({ slug, closeHref, productId, purchaseId }: { slug: CompanySlug; closeHref: string; productId?: string; purchaseId?: string }) {
  const [catalogue, purchases] = await Promise.all([getCatalogue(), listPurchases(slug)]);
  const tracked = catalogue.filter((c) => c.trackSerials && c.type === "PRODUCT");
  const items = await prisma.purchaseItem.findMany({
    where: { purchaseId: { in: purchases.map((p) => p.id) }, productId: { in: tracked.map((t) => t.id) } },
    select: { purchaseId: true, productId: true },
  });
  return (
    <Modal title="Register serial numbers" closeHref={closeHref} size="md">
      <RegisterSerialsForm
        key={crypto.randomUUID()}
        companySlug={slug}
        products={tracked.map((t) => ({ id: t.id, label: `${t.code} · ${t.name}` }))}
        purchases={purchases
          .filter((p) => items.some((i) => i.purchaseId === p.id))
          .map((p) => ({
            id: p.id,
            label: `${p.supplierName} · ${p.invoiceNumber} · ${dayFormat.format(p.purchaseDate)}`,
            productIds: items.filter((i) => i.purchaseId === p.id).map((i) => i.productId),
          }))}
        defaults={{ productId, purchaseId }}
        returnTo={closeHref}
      />
    </Modal>
  );
}

export async function ReceiveGoodsDialog({ slug, closeHref, orderId }: { slug: CompanySlug; closeHref: string; orderId: string }) {
  const [suppliers, catalogue, order] = await Promise.all([listSuppliers(), productCatalogue(), getPurchaseOrder(slug, orderId)]);
  if (!order || order.status === "RECEIVED" || order.status === "CANCELLED")
    return (
      <Modal title="Receive goods" closeHref={closeHref} size="md">
        <p className={`${cardClass} p-6 text-center text-sm text-muted`}>
          {order ? `Purchase order ${order.number} is ${order.status.toLowerCase()}, so it can't be received.` : "This purchase order no longer exists."}
        </p>
      </Modal>
    );
  return (
    <Modal title={`Receive ${order.number}`} closeHref={closeHref} size="full">
      <PurchaseForm
        key={crypto.randomUUID()}
        companySlug={slug}
        companyName={COMPANIES[slug].name}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        catalogue={catalogue}
        fromOrder={{
          purchaseOrderId: order.id,
          number: order.number,
          supplierId: order.supplierId,
          discount: order.discount,
          rows: order.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPriceHT: l.unitPriceHT })),
        }}
        returnTo={closeHref}
      />
    </Modal>
  );
}

export async function NewVesselDialog({ closeHref, slug, customerId }: { slug: CompanySlug; closeHref: string; customerId?: string }) {
  const customers = await listCustomers();
  return (
    <Modal title="New boat" closeHref={closeHref} size="xl">
      <VesselForm key={crypto.randomUUID()} companySlug={slug} customers={customers.map((c) => ({ id: c.id, name: c.name }))} defaultCustomerId={customerId} returnTo={closeHref} />
    </Modal>
  );
}

export async function NewAppointmentDialog({ slug, closeHref, customerId }: { slug: CompanySlug; closeHref: string; customerId?: string }) {
  const [customers, vessels] = await Promise.all([listCustomers(), vesselOptions()]);
  return (
    <Modal title="Book an appointment" closeHref={closeHref} size="md">
      <NewAppointmentForm
        key={crypto.randomUUID()}
        companySlug={slug}
        slots={APPOINTMENT_SLOTS}
        date={businessToday()}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        vessels={vessels}
        defaultCustomerId={customerId}
        returnTo={closeHref}
      />
    </Modal>
  );
}
