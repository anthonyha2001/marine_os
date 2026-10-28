"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { Ban, FileMinus, HandCoins } from "lucide-react";
import { cancelInvoice } from "@/lib/actions/invoices";
import { useFeedback } from "@/components/feedback";
import type { InvoiceStatus } from "@/lib/offers";
import { Kbd, primaryButton, secondaryButton } from "@/components/ui";

/** PDF buttons (Ctrl+P opens the PDF), record a payment, issue a credit note, cancel. */
export function InvoiceActions({
  companySlug,
  invoiceId,
  status,
  balance,
  creditable,
  hasSettlements,
}: {
  companySlug: string;
  invoiceId: string;
  status: InvoiceStatus;
  balance: number;
  creditable: number;
  hasSettlements: boolean;
}) {
  const pdfUrl = `/c/${companySlug}/invoices/${invoiceId}/pdf`;
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();

  useEffect(() => {
    // Effects stop while this page is hidden in the background, so this only fires on screen.
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.open(pdfUrl, "_blank", "noopener");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pdfUrl]);

  const cancel = async () => {
    if (hasSettlements) {
      toast.error("This invoice has payments or credit notes. Delete the payments, or issue a credit note for the rest, instead of cancelling.");
      return;
    }
    const ok = await confirm({
      title: "Cancel this invoice?",
      message: "The invoice is voided and its accounting entry is reversed. The payment can then be invoiced again from the offer.",
      confirmLabel: "Cancel invoice",
      cancelLabel: "Keep it",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        const res = await cancelInvoice(companySlug, invoiceId);
        if (res.error) toast.error(res.error);
        else toast.success("Invoice cancelled.");
      } catch {
        toast.error("The invoice couldn't be cancelled. Check your connection and try again.");
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "CANCELLED" && balance > 0 && (
        <Link href={`/c/${companySlug}/invoices/${invoiceId}?pay=1`} scroll={false} className={primaryButton}>
          <HandCoins className="size-4" aria-hidden /> Record payment
        </Link>
      )}
      <a href={pdfUrl} target="_blank" rel="noopener" className={`${status !== "CANCELLED" && balance > 0 ? secondaryButton : primaryButton} gap-2`}>
        Open PDF <Kbd className={status !== "CANCELLED" && balance > 0 ? "" : "border-white/30 bg-white/10 text-white"}>Ctrl P</Kbd>
      </a>
      <a href={`${pdfUrl}?download=1`} className={secondaryButton}>
        Download PDF
      </a>
      {status !== "CANCELLED" && creditable > 0 && (
        <Link href={`/c/${companySlug}/finance/credit-notes/new?invoice=${invoiceId}`} className={secondaryButton}>
          <FileMinus className="size-4" aria-hidden /> Credit note
        </Link>
      )}
      {status !== "CANCELLED" && (
        <button type="button" disabled={pending} onClick={cancel} className={`${secondaryButton} text-danger hover:bg-red-50`}>
          <Ban className="size-4" aria-hidden /> Cancel invoice
        </button>
      )}
    </div>
  );
}
