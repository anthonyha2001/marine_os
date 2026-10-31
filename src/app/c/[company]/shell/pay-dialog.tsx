"use client";

import { useEffect, useState } from "react";
import { useFeedback } from "@/components/feedback";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, FileDown } from "lucide-react";
import { paymentFormData, type PayKind, type PaymentFormData } from "@/lib/actions/payments";
import { Modal } from "@/components/modal";
import { primaryButton, secondaryButton } from "@/components/ui";
import { ReceiptForm } from "../finance/receipts/receipt-form";
import { SupplierPaymentForm } from "../finance/vouchers/supplier-payment-form";
import { VoucherForm } from "../finance/vouchers/voucher-form";

const TITLES: Record<PayKind, string> = {
  CUSTOMER: "Customer payment (RV)",
  SUPPLIER: "Pay a supplier (PV)",
  PAYMENT: "Payment voucher (PV)",
  RECEIPT: "Receipt voucher (RV)",
  TRANSFER: "Transfer between cash and bank",
};
const KINDS = Object.keys(TITLES) as PayKind[];
const PARAMS = ["pay", "payInvoice", "payBill", "payCustomer"];

/**
 * The payment pop-up. Any page opens it with ?pay=… (see payHref in lib/url.ts) and stays where it is:
 * no jump to the vouchers page. Only mounted for people allowed to pay (accounting).
 */
export function PayDialog({ companySlug }: { companySlug: string }) {
  const params = useSearchParams();
  const kind = params.get("pay") as PayKind | null;
  if (!kind || !KINDS.includes(kind)) return null;
  const key = PARAMS.map((p) => params.get(p) ?? "").join("|");
  return (
    <PayPopup
      key={key}
      companySlug={companySlug}
      kind={kind}
      invoiceId={params.get("payInvoice") ?? undefined}
      billId={params.get("payBill") ?? undefined}
      customerId={params.get("payCustomer") ?? undefined}
    />
  );
}

function PayPopup({ companySlug, kind, invoiceId, billId, customerId }: { companySlug: string; kind: PayKind; invoiceId?: string; billId?: string; customerId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = useState<PaymentFormData | null>(null);
  const [failed, setFailed] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [round, setRound] = useState(0); // a new empty form after "Save & new"
  const { toast } = useFeedback();
  const onSaved = (id: string, again?: boolean) => {
    if (!again) return setSavedId(id);
    toast.success("Saved. Enter the next one.");
    setRound((n) => n + 1);
  };

  useEffect(() => {
    let live = true;
    paymentFormData(companySlug, kind, customerId)
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [companySlug, kind, customerId, round]); // after "Save & new", reload balances

  const close = () => {
    const rest = new URLSearchParams(params.toString());
    for (const p of PARAMS) rest.delete(p);
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Modal title={TITLES[kind]} onClose={close} size="md">
      {savedId ? (
        <div className="space-y-5 py-2 text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
          <p className="font-semibold text-navy">Saved. The balances on this page are updated.</p>
          <div className="flex justify-center gap-2">
            <a href={`/c/${companySlug}/finance/vouchers/${savedId}/pdf`} target="_blank" rel="noopener" className={secondaryButton}>
              <FileDown className="size-4" aria-hidden /> Print voucher
            </a>
            <button type="button" onClick={close} className={primaryButton} autoFocus>
              Done
            </button>
          </div>
        </div>
      ) : failed ? (
        <p className="py-6 text-center text-sm text-danger">This could not be opened. Only accounting can record payments.</p>
      ) : !data ? (
        <p className="py-10 text-center text-sm text-muted">Loading…</p>
      ) : data.kind === "SUPPLIER" && "bills" in data ? (
        <SupplierPaymentForm companySlug={companySlug} bills={data.bills} accounts={data.accounts} defaultBillId={billId} key={round} onSaved={onSaved} />
      ) : data.kind === "CUSTOMER" && "invoices" in data ? (
        <ReceiptForm
          companySlug={companySlug}
          accounts={data.accounts}
          invoices={data.invoices}
          customers={data.customers}
          defaultInvoiceId={invoiceId}
          defaultCustomerId={customerId}
          key={round} onSaved={onSaved}
        />
      ) : "counterAccounts" in data && (kind === "PAYMENT" || kind === "RECEIPT" || kind === "TRANSFER") ? (
        <VoucherForm companySlug={companySlug} kind={kind} moneyAccounts={data.accounts} counterAccounts={data.counterAccounts} key={round} onSaved={onSaved} />
      ) : null}
    </Modal>
  );
}
