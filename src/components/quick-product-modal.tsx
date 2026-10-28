"use client";

import { useState, useTransition } from "react";
import { quickCreateProduct, type QuickProduct } from "@/lib/actions/products";
import { formatMoney, withVat, VAT_RATE } from "@/lib/money";
import { Modal } from "@/components/modal";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButton } from "@/components/ui";

/**
 * Create a product without leaving an order/purchase form: the new product is handed back
 * through onCreated so the form can add it as a line. Picture and details can be added later.
 */
export function QuickProductModal({
  companySlug,
  defaultName,
  defaultSupplierId,
  suppliers,
  onCreated,
  onClose,
}: {
  companySlug: string;
  defaultName: string;
  defaultSupplierId: string;
  suppliers: { id: string; name: string }[];
  onCreated: (product: QuickProduct) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [price, setPrice] = useState("");
  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const [minQuantity, setMinQuantity] = useState("0");
  const [barcodes, setBarcodes] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const priceInput = useFocusOnShow<HTMLInputElement>();

  const priceNumber = Number(price);
  const ttc = price !== "" && Number.isFinite(priceNumber) ? withVat(priceNumber) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await quickCreateProduct(companySlug, {
          name,
          priceHT: priceNumber,
          supplierId: supplierId || null,
          minQuantity: Number(minQuantity) || 0,
          barcodes,
          description,
        });
        if (result.product) onCreated(result.product);
        else setError(result.error);
      } catch {
        setError("The product couldn't be created. Check your connection and try again.");
      }
    });
  }

  return (
    <Modal title="New product" onClose={onClose} size="md">
      <form onSubmit={submit} data-save-shortcut data-dirty={name !== defaultName || price !== ""} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <label className={labelClass}>
          Product name *
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Price excl. VAT *
            <input
              ref={priceInput}
              type="number"
              min="0"
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </label>
          <div>
            <p className={labelClass}>Price TTC (+{VAT_RATE * 100}%)</p>
            <p className="mt-1 rounded-lg bg-background px-3 py-2 text-sm font-semibold text-navy">{ttc === null ? "—" : formatMoney(ttc)}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Supplier
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Minimum quantity
            <input type="number" min="0" step="1" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className={labelClass}>
          Barcodes (optional, one per line)
          <textarea
            rows={2}
            value={barcodes}
            onChange={(e) => setBarcodes(e.target.value)}
            placeholder="Scan or type; leave empty to generate one"
            className={`${inputClass} font-mono`}
          />
        </label>
        <label className={labelClass}>
          Description
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </label>
        <p className="text-xs text-muted">The 4-digit code is assigned automatically. Add a picture later from Stock.</p>
        <FormMessage error={error} />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={`${primaryButton} flex-1 gap-2`}>
            {pending ? "Creating…" : "Create and add to the lines"}
            <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
          </button>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
