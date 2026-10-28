import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Coins, LockKeyhole, ReceiptText } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { expectedCash, getRate, listSales, openShiftFor, posCatalogue } from "@/lib/data/pos";
import { listCustomers } from "@/lib/data/sales";
import { formatMoney, round2 } from "@/lib/money";
import { canSetRate, formatRate, hasPos, maxDiscountFor } from "@/lib/pos";
import { COMPANIES } from "@/lib/permissions";
import { Modal } from "@/components/modal";
import { EmptyState, PageHeader, cardClass, secondaryButton } from "@/components/ui";
import { PosTerminal } from "./pos-terminal";
import { CloseShiftForm, OpenShiftForm, RateForm } from "./shift-forms";

type Search = { rate?: string; close?: string; rateSaved?: string };
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" });

async function PosContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "sales");
  if (!hasPos(slug)) notFound();
  const base = `/c/${slug}/pos`;
  const [rate, shift] = await Promise.all([getRate(slug), openShiftFor(slug, user.id)]);
  const mayRate = canSetRate(user.role);

  const rateButton = mayRate && (
    <Link href={`${base}?rate=1`} scroll={false} className={secondaryButton}>
      <Coins className="size-4" aria-hidden /> {rate ? formatRate(rate.lbpPerUsd) : "Set rate"}
    </Link>
  );
  const rateSaved = search.rateSaved && rate && (
    <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-success">
      Rate saved: {formatRate(rate.lbpPerUsd)}. New sales use it; sales already made keep their rate.
    </p>
  );
  const rateModal = search.rate && mayRate && (
    <Modal title="Exchange rate" closeHref={base} size="md">
      <RateForm key={crypto.randomUUID()} companySlug={slug} current={rate?.lbpPerUsd ?? null} />
    </Modal>
  );

  if (!rate) {
    return (
      <>
        <PageHeader eyebrow={`${COMPANIES[slug].name} · Retail`} title="Point of sale" action={rateButton} />
        <div className={`${cardClass} mt-6`}>
          <EmptyState
            icon={Coins}
            title="Set today's exchange rate first"
            description={mayRate ? "The till needs the LBP rate to take cash in Lebanese pounds." : "Ask a manager or the accountant to set the LBP rate."}
            action={
              mayRate && (
                <Link href={`${base}?rate=1`} className={secondaryButton}>
                  Set the rate
                </Link>
              )
            }
          />
        </div>
        {rateModal}
      </>
    );
  }

  if (!shift) {
    return (
      <>
        <PageHeader
          eyebrow={`${COMPANIES[slug].name} · Retail`}
          title="Point of sale"
          description={`Rate ${formatRate(rate.lbpPerUsd)}, set by ${rate.setByName}.`}
          action={rateButton}
        />
        {rateSaved}
        <div className="mx-auto mt-10 max-w-lg">
          <div className={`${cardClass} p-6`}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
              <LockKeyhole className="size-5 text-brand" aria-hidden /> Open your shift
            </h2>
            <div className="mt-4">
              <OpenShiftForm key={crypto.randomUUID()} companySlug={slug} />
            </div>
          </div>
        </div>
        {rateModal}
      </>
    );
  }

  const [products, customers, sales] = await Promise.all([posCatalogue(slug), listCustomers(), listSales(slug)]);
  const shiftSales = sales.filter((s) => s.shiftId === shift.id);
  const takings = round2(shiftSales.reduce((s, x) => s + x.totalTTC, 0));
  const expected = expectedCash(shift, sales);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-brand">{COMPANIES[slug].name} · Retail</p>
          <h1 className="text-2xl font-semibold tracking-tight text-navy">Point of sale</h1>
          <p className="text-sm text-muted">
            Shift {shift.number} · {user.name} · since {time.format(shift.openedAt)} · {shiftSales.length} sale{shiftSales.length === 1 ? "" : "s"},{" "}
            <span className="tabular font-medium text-navy">{formatMoney(takings)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rateButton || (
            <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted">
              <Coins className="size-4" aria-hidden /> {formatRate(rate.lbpPerUsd)}
            </span>
          )}
          <Link href={`${base}/sales`} className={secondaryButton}>
            <ReceiptText className="size-4" aria-hidden /> Sales
          </Link>
          <Link href={`${base}?close=1`} scroll={false} className={secondaryButton}>
            <CalendarClock className="size-4" aria-hidden /> Close shift
          </Link>
        </div>
      </div>

      {rateSaved}
      <div className="mt-5">
        <PosTerminal
          companySlug={slug}
          products={products}
          customers={customers.map((c) => ({ id: c.id, name: c.name, taxNumber: c.taxNumber }))}
          rate={rate.lbpPerUsd}
          maxDiscount={maxDiscountFor(user.role)}
        />
      </div>

      {search.close && (
        <Modal title={`Close shift ${shift.number}`} closeHref={base} size="md">
          <CloseShiftForm key={crypto.randomUUID()} companySlug={slug} shiftId={shift.id} expectedUsd={expected.usd} expectedLbp={expected.lbp} rate={rate.lbpPerUsd} />
        </Modal>
      )}
      {rateModal}
    </>
  );
}

export default function PosPage({ params, searchParams }: PageProps<"/c/[company]/pos">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the till…</p>}>
      <PosContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
