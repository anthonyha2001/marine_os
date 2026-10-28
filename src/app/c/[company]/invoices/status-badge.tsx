import { INVOICE_STATUSES, type InvoiceStatus } from "@/lib/offers";

const STYLE: Record<InvoiceStatus, string> = {
  ISSUED: "bg-amber-50 text-amber-700",
  PAID: "bg-green-50 text-success",
  CANCELLED: "bg-gray-100 text-muted",
};

/** Status pill; unpaid invoices past their due date show as overdue, partly settled ones as such. */
export function InvoiceStatusBadge({ status, dueDate, partial = false }: { status: InvoiceStatus; dueDate: Date; partial?: boolean }) {
  const overdue = status === "ISSUED" && dueDate.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);
  const label = overdue ? "Overdue" : status === "ISSUED" && partial ? "Partly paid" : INVOICE_STATUSES[status];
  const style = overdue ? "bg-red-50 text-danger" : status === "ISSUED" && partial ? "bg-blue-50 text-blue-700" : STYLE[status];
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
