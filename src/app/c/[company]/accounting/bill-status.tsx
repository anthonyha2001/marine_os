import { BILL_STATUS_LABELS, type BillStatus } from "@/lib/accounting";

const STYLE: Record<BillStatus, string> = {
  PAID: "bg-green-50 text-success",
  PARTLY_PAID: "bg-blue-50 text-brand",
  UNPAID: "bg-amber-50 text-amber-700",
  OVERDUE: "bg-red-50 text-danger",
};

export function BillStatusBadge({ status }: { status: BillStatus }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[status]}`}>{BILL_STATUS_LABELS[status]}</span>;
}
