"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Ban, PackageCheck, Trash2 } from "lucide-react";
import { cancelTransfer, receiveTransfer, sendTransfer, type StockFormState } from "@/lib/actions/stock-ops";
import { useFeedback } from "@/components/feedback";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButton } from "@/components/ui";

type Product = { id: string; code: string; name: string; stock: number; barcodes: string[] };
type Line = { productId: string; quantity: string };

/** Pick products and quantities to send to the sister company. */
export function SendTransferForm({ companySlug, toCompany, products }: { companySlug: string; toCompany: { slug: string; name: string }; products: Product[] }) {
  const [state, formAction, pending] = useActionState<StockFormState, FormData>(sendTransfer.bind(null, companySlug), {});
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const search = useFocusOnShow<HTMLInputElement>();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const q = query.trim().toLowerCase();
  const matches = q ? products.filter((p) => !lines.some((l) => l.productId === p.id) && (p.name.toLowerCase().includes(q) || p.code.startsWith(q) || p.barcodes.includes(query.trim()))).slice(0, 6) : [];
  const add = (p: Product) => {
    setLines((ls) => [...ls, { productId: p.id, quantity: "1" }]);
    setQuery("");
  };

  return (
    <form
      action={(fd) => {
        fd.set(
          "payload",
          JSON.stringify({ toCompany: toCompany.slug, notes: fd.get("notes"), lines: lines.map((l) => ({ productId: l.productId, quantity: Math.round(Number(l.quantity) || 0) })) }),
        );
        return formAction(fd);
      }}
      data-save-shortcut
      className="space-y-4"
    >
      <p className="rounded-lg bg-background p-3 text-sm">
        To <span className="font-semibold text-navy">{toCompany.name}</span>. The goods leave your stock now and arrive in theirs when they confirm receipt. Valued at your average cost (purchases incl. landed costs).
      </p>
      <div className="relative">
        <input
          ref={search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) add(matches[0]);
            }
          }}
          placeholder="Scan or search a product to add…"
          aria-label="Add a product"
          className={inputClass}
        />
        {matches.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg" role="listbox">
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(p)} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-surface-2">
                  <span>
                    <span className="font-mono text-xs text-muted">{p.code}</span> {p.name}
                  </span>
                  <span className="text-xs text-muted">{p.stock} in stock</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {lines.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="py-2">Product</th>
              <th className="py-2 text-right">In stock</th>
              <th className="w-28 py-2 text-right">Send</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((l) => {
              const p = byId.get(l.productId)!;
              const tooMany = (Number(l.quantity) || 0) > p.stock;
              return (
                <tr key={l.productId}>
                  <td className="py-2">
                    <span className="font-mono text-xs text-muted">{p.code}</span> <span className="font-medium text-navy">{p.name}</span>
                  </td>
                  <td className="tabular py-2 text-right text-muted">{p.stock}</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={l.quantity}
                      onChange={(e) => setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, quantity: e.target.value } : x)))}
                      aria-label={`Quantity of ${p.name}`}
                      className={`${inputClass} h-9 w-24 text-right ${tooMany ? "border-danger" : ""}`}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))} title="Remove" aria-label={`Remove ${p.name}`} className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-danger">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <label className={labelClass}>
        Note
        <input name="notes" maxLength={1000} placeholder="e.g. For the Jounieh shop" className={inputClass} />
      </label>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending || !lines.length} className={`${primaryButton} w-full gap-2`}>
        {pending ? "Sending…" : "Send goods"}
        <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
      </button>
    </form>
  );
}

export function TransferActions({ companySlug, transferId, number, side }: { companySlug: string; transferId: string; number: string; side: "IN" | "OUT" }) {
  const [pending, startTransition] = useTransition();
  const { confirm, toast } = useFeedback();
  return side === "IN" ? (
    <button
      type="button"
      disabled={pending}
      className={primaryButton}
      onClick={async () => {
        if (!(await confirm({ title: `Receive ${number}?`, message: "Confirm the goods arrived. They are added to this company's stock.", confirmLabel: "Goods received" }))) return;
        startTransition(async () => {
          const res = await receiveTransfer(companySlug, transferId);
          if (res.error) toast.error(res.error);
          else toast.success("Goods received and added to stock.");
        });
      }}
    >
      <PackageCheck className="size-4" aria-hidden /> Receive
    </button>
  ) : (
    <button
      type="button"
      disabled={pending}
      className={`${secondaryButton} text-danger hover:bg-red-50`}
      onClick={async () => {
        if (!(await confirm({ title: `Cancel ${number}?`, message: "The goods come back into your stock.", confirmLabel: "Cancel transfer", tone: "danger" }))) return;
        startTransition(async () => {
          const res = await cancelTransfer(companySlug, transferId);
          if (res.error) toast.error(res.error);
          else toast.success("Transfer cancelled.");
        });
      }}
    >
      <Ban className="size-4" aria-hidden /> Cancel
    </button>
  );
}
