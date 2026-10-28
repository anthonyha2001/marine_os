"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { saveProduct, type ProductFormState } from "@/lib/actions/products";
import { formatMoney, withVat, VAT_RATE } from "@/lib/money";
import { useFocusOnShow } from "@/components/use-focus-on-show";
import { FormMessage, Kbd, inputClass, labelClass, primaryButton, secondaryButton } from "@/components/ui";

type ProductInput = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  supplierId: string | null;
  priceHT: number;
  minQuantity: number;
  trackSerials?: boolean;
  imageUrl: string | null;
  barcodes: string[];
};

/** Shrink large photos in the browser so uploads stay small (max 1200px, WebP). */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/webp", 0.85));
}

export function ProductForm({
  companySlug,
  suppliers,
  product,
}: {
  companySlug: string;
  suppliers: { id: string; name: string }[];
  product?: ProductInput;
}) {
  const [price, setPrice] = useState(product ? String(product.priceHT) : "");
  const [barcodes, setBarcodes] = useState<string[]>(product?.barcodes ?? []);
  const [barcodeDraft, setBarcodeDraft] = useState("");
  const [preview, setPreview] = useState<string | null>(product?.imageUrl ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [dirty, setDirty] = useState(false);
  const nameInput = useFocusOnShow<HTMLInputElement>(!product);
  const resized = useRef<Blob | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(async (prev, formData) => {
    formData.delete("image");
    if (resized.current) formData.set("image", resized.current, "picture.webp");
    // Include a barcode that was typed but not added yet.
    const pendingCode = barcodeDraft.trim();
    formData.set("barcodes", [...barcodes, ...(pendingCode ? [pendingCode] : [])].join("\n"));
    return saveProduct(companySlug, product?.id ?? null, prev, formData);
  }, {});

  const priceNumber = Number(price);
  const ttc = price !== "" && Number.isFinite(priceNumber) ? withVat(priceNumber) : null;

  function addBarcode() {
    const code = barcodeDraft.trim();
    if (code && !barcodes.includes(code)) setBarcodes([...barcodes, code]);
    setBarcodeDraft("");
  }

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    resized.current = await resizeImage(file);
    setPreview(URL.createObjectURL(resized.current));
    setRemoveImage(false);
  }

  return (
    <form
      action={formAction}
      data-save-shortcut
      data-dirty={dirty}
      onInput={() => setDirty(true)}
      className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]"
    >
      <div className="space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
          <label className={labelClass}>
            Product name *
            <input ref={nameInput} name="name" required defaultValue={product?.name} className={inputClass} />
          </label>
          <div>
            <p className={labelClass}>Code</p>
            <p className="mt-1 rounded-lg bg-background px-3 py-2 font-mono text-sm text-muted">
              {product?.code ?? "Automatic"}
            </p>
          </div>
        </div>

        <label className={labelClass}>
          Description
          <textarea name="description" rows={3} defaultValue={product?.description ?? ""} className={inputClass} />
        </label>

        <label className={labelClass}>
          Supplier
          <select name="supplierId" defaultValue={product?.supplierId ?? ""} className={inputClass}>
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {suppliers.length === 0 && (
            <span className="mt-1 block text-xs font-normal text-muted">
              No suppliers yet.{" "}
              <Link href={`/c/${companySlug}/suppliers`} className="text-brand hover:underline" target="_blank">
                Add one
              </Link>{" "}
              and reload this page.
            </span>
          )}
        </label>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className={labelClass}>
            Price excl. VAT *
            <input
              name="priceHT"
              type="number"
              step="0.01"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </label>
          <div>
            <p className={labelClass}>Price TTC (+{VAT_RATE * 100}%)</p>
            <p className="mt-1 rounded-lg bg-background px-3 py-2 text-sm font-semibold text-navy">
              {ttc === null ? "—" : formatMoney(ttc)}
            </p>
          </div>
          <label className={labelClass}>
            Minimum quantity
            <input
              name="minQuantity"
              type="number"
              min="0"
              step="1"
              defaultValue={product?.minQuantity ?? 0}
              className={inputClass}
            />
          </label>
          <label className="flex items-start gap-2 pt-6 text-sm">
            <input type="checkbox" name="trackSerials" defaultChecked={product?.trackSerials ?? false} className="mt-0.5 size-4 accent-brand" />
            <span>
              <span className="font-medium text-navy">Track serial numbers</span>
              <span className="block text-xs text-muted">For engines, outboards… each unit is followed from purchase to customer.</span>
            </span>
          </label>
        </div>

        <div>
          <p className={labelClass}>Barcodes</p>
          <div className="mt-1 flex gap-2">
            <input
              value={barcodeDraft}
              onChange={(e) => setBarcodeDraft(e.target.value)}
              onKeyDown={(e) => {
                // Scanners type the code then press Enter: add it instead of submitting.
                if (e.key === "Enter") {
                  e.preventDefault();
                  addBarcode();
                }
              }}
              placeholder="Scan or type a barcode, then Enter"
              className={`${inputClass} mt-0`}
            />
            <button type="button" onClick={addBarcode} className={secondaryButton}>
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {barcodes.map((code) => (
              <span key={code} className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 font-mono text-xs">
                {code}
                <button
                  type="button"
                  onClick={() => setBarcodes(barcodes.filter((b) => b !== code))}
                  className="ml-1 text-muted hover:text-danger"
                  aria-label={`Remove barcode ${code}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            Add as many as you need. Leave empty and a barcode is generated automatically.
          </p>
        </div>

        <FormMessage error={state.error} />

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={`${primaryButton} gap-2`}>
            {pending ? "Saving…" : product ? "Save changes" : "Create product"}
            <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
          </button>
          {!product && (
            <button type="submit" name="intent" value="new" data-save-new disabled={pending} className={`${secondaryButton} gap-2`}>
              Save &amp; add another <Kbd>Ctrl Shift S</Kbd>
            </button>
          )}
          <Link href={`/c/${companySlug}/inventory`} className={secondaryButton}>
            Cancel
          </Link>
        </div>
      </div>

      <div className="h-fit rounded-2xl border border-border bg-surface p-5">
        <p className={labelClass}>Picture</p>
        <div className="mt-2 flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background">
          {preview && !removeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Product" className="h-full w-full object-contain" />
          ) : (
            <span className="text-sm text-muted">No picture</span>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onPickImage(e.target.files?.[0])}
        />
        <input type="hidden" name="removeImage" value={String(removeImage)} />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} className={`${secondaryButton} flex-1`}>
            {preview && !removeImage ? "Change" : "Upload"}
          </button>
          {preview && !removeImage && (
            <button
              type="button"
              onClick={() => {
                resized.current = null;
                setRemoveImage(true);
                if (fileInput.current) fileInput.current.value = "";
              }}
              className={secondaryButton}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
