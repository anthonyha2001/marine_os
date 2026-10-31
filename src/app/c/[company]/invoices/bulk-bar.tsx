"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, Printer, Send, X } from "lucide-react";
import { formatMoney, round2 } from "@/lib/money";
import { Modal } from "@/components/modal";
import { useRowSelection } from "@/components/row-selection";
import { SendButton } from "@/components/send-button";
import { secondaryButtonSm } from "@/components/ui";

export type BulkInvoice = { id: string; number: string; customerName: string; invoiceDate: string; dueDate: string; status: string; totalTTC: number; balance: number };

const csvCell = (v: string | number) => (typeof v === "number" ? String(v) : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** What to do with the selected invoices: one PDF to print, download, send each, or a spreadsheet. */
export function InvoiceBulkBar({ companySlug, invoices }: { companySlug: string; invoices: BulkInvoice[] }) {
  const selection = useRowSelection();
  const [sending, setSending] = useState(false);
  const chosen = invoices.filter((i) => selection?.selected.includes(i.id));
  if (!selection || chosen.length === 0) return null;

  const pdf = `/c/${companySlug}/invoices/bulk-pdf?ids=${chosen.map((i) => i.id).join(",")}`;
  const total = round2(chosen.reduce((s, i) => s + i.totalTTC, 0));
  const due = round2(chosen.reduce((s, i) => s + i.balance, 0));

  const spreadsheet = () => {
    const rows = [
      ["Invoice", "Date", "Due", "Customer", "Status", "Amount", "Balance due"],
      ...chosen.map((i) => [i.number, i.invoiceDate, i.dueDate, i.customerName, i.status, i.totalTTC, i.balance]),
    ];
    // The BOM makes Excel read accents and Arabic correctly.
    const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  return (
    <>
      <div role="region" aria-label="Selected invoices" className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-navy px-4 py-2.5 text-sm text-white shadow-2xl">
          <span className="mr-2">
            <span className="font-semibold">{chosen.length}</span> selected · {formatMoney(total)}
            {due > 0 && <span className="text-white/70"> · {formatMoney(due)} due</span>}
          </span>
          <a href={pdf} target="_blank" rel="noopener" className={`${secondaryButtonSm} border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white`}>
            <Printer className="size-3.5" aria-hidden /> PDF / print
          </a>
          <a href={`${pdf}&download=1`} className={`${secondaryButtonSm} border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white`}>
            <FileDown className="size-3.5" aria-hidden /> Download
          </a>
          <button type="button" onClick={() => setSending(true)} className={`${secondaryButtonSm} border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white`}>
            <Send className="size-3.5" aria-hidden /> Send
          </button>
          <button type="button" onClick={spreadsheet} className={`${secondaryButtonSm} border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white`}>
            <FileSpreadsheet className="size-3.5" aria-hidden /> Excel
          </button>
          <button type="button" onClick={selection.clear} title="Clear the selection (Esc)" aria-label="Clear the selection" className="ml-1 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {sending && (
        <Modal title={`Send ${chosen.length} invoice${chosen.length === 1 ? "" : "s"}`} onClose={() => setSending(false)} size="lg">
          <p className="mb-3 text-sm text-muted">Each customer gets their own message with a private link to the invoice.</p>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {chosen.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="font-mono text-xs font-semibold text-brand">{i.number}</span>
                  <span className="ml-2 font-medium text-navy">{i.customerName}</span>
                  <span className="ml-2 text-xs text-muted">{formatMoney(i.totalTTC)}</span>
                </span>
                <SendButton companySlug={companySlug} kind="invoice" id={i.id} />
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
