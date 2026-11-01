"use client";

import { useRef, useState, useTransition } from "react";
import { Download, File as FileIcon, FileSpreadsheet, FileText, Pencil, Trash2, Upload } from "lucide-react";
import { deleteSupplierDocument, renameSupplierDocument, uploadSupplierDocument } from "@/lib/actions/suppliers";
import { useFeedback } from "@/components/feedback";
import { inputClass, secondaryButton } from "@/components/ui";

export type SupplierDoc = { id: string; name: string; contentType: string; size: number; uploadedBy: string | null; createdAt: Date };

const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";

/** Large photos are shrunk in the browser before upload (keeps them under the 4 MB limit). */
async function shrinkPhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function TypeIcon({ type }: { type: string }) {
  const cls = "size-9 text-muted";
  if (type === "application/pdf") return <FileText className={`${cls} text-red-500`} aria-hidden />;
  if (/sheet|excel|csv/.test(type)) return <FileSpreadsheet className={`${cls} text-emerald-600`} aria-hidden />;
  if (/word/.test(type)) return <FileText className={`${cls} text-blue-600`} aria-hidden />;
  return <FileIcon className={cls} aria-hidden />;
}

/** Files kept on a supplier: drop or pick them, open, rename, download or delete. */
export function SupplierDocuments({ companySlug, supplierId, docs }: { companySlug: string; supplierId: string; docs: SupplierDoc[] }) {
  const { confirm, toast } = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [, start] = useTransition();
  const href = (id: string) => `/c/${companySlug}/suppliers/documents/${id}`;

  async function upload(files: File[]) {
    if (!files.length || progress) return;
    let added = 0;
    for (const [i, original] of files.entries()) {
      setProgress(`Uploading ${i + 1} of ${files.length}…`);
      const fd = new FormData();
      fd.set("file", await shrinkPhoto(original));
      fd.set("name", original.name);
      const r = await uploadSupplierDocument(companySlug, supplierId, fd).catch(() => ({ error: `${original.name} could not be uploaded.` }));
      if (r.error) toast.error(r.error);
      else added++;
    }
    setProgress(null);
    if (input.current) input.current.value = "";
    if (added) toast.success(added === 1 ? "File added." : `${added} files added.`);
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy">
          Documents &amp; photos {docs.length > 0 && <span className="font-normal text-muted">({docs.length})</span>}
        </h3>
        <button type="button" onClick={() => input.current?.click()} disabled={!!progress} className={`${secondaryButton} gap-2`}>
          <Upload className="size-4" aria-hidden /> {progress ?? "Add files"}
        </button>
        <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => upload(Array.from(e.target.files ?? []))} />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(Array.from(e.dataTransfer.files));
        }}
        className={`rounded-lg border-2 border-dashed p-3 transition ${dragging ? "border-brand bg-brand/5" : "border-border"}`}
      >
        {docs.length === 0 ? (
          <button type="button" onClick={() => input.current?.click()} className="w-full py-6 text-center text-sm text-muted">
            Drop contracts, price lists, certificates or photos here, or click to choose.
            <span className="mt-1 block text-xs">Photos, PDF, Word, Excel · 4 MB per file</span>
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
            {docs.map((d) => (
              <li key={d.id} className="group overflow-hidden rounded-md border border-border bg-surface">
                <a href={href(d.id)} target="_blank" rel="noopener" className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-background" title="Open">
                  {d.contentType.startsWith("image/") && d.contentType !== "image/heic" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private file served by the app
                    <img src={href(d.id)} alt={d.name} loading="lazy" className="size-full object-cover transition group-hover:opacity-90" />
                  ) : (
                    <TypeIcon type={d.contentType} />
                  )}
                </a>
                <div className="p-2">
                  {renaming === d.id ? (
                    <input
                      autoFocus
                      defaultValue={d.name}
                      className={`${inputClass} mt-0 py-1 text-xs`}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRenaming(null);
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={(e) => {
                        const name = e.currentTarget.value;
                        setRenaming(null);
                        if (name.trim() && name !== d.name)
                          start(async () => {
                            const r = await renameSupplierDocument(companySlug, d.id, name);
                            if (r.error) toast.error(r.error);
                          });
                      }}
                    />
                  ) : (
                    <p className="truncate text-xs font-medium text-navy" title={d.name}>
                      {d.name}
                    </p>
                  )}
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {sizeLabel(d.size)} · {new Date(d.createdAt).toLocaleDateString("en-GB")}
                    {d.uploadedBy && ` · ${d.uploadedBy}`}
                  </p>
                  <div className="mt-1.5 flex gap-1">
                    <button type="button" onClick={() => setRenaming(d.id)} className="rounded p-1 text-muted hover:bg-background hover:text-navy" aria-label="Rename" title="Rename">
                      <Pencil className="size-3.5" />
                    </button>
                    <a href={`${href(d.id)}?download`} className="rounded p-1 text-muted hover:bg-background hover:text-navy" aria-label="Download" title="Download">
                      <Download className="size-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!(await confirm({ title: `Delete ${d.name}?`, message: "The file is removed for both companies.", confirmLabel: "Delete", tone: "danger" }))) return;
                        start(async () => {
                          const r = await deleteSupplierDocument(companySlug, d.id);
                          if (r.error) toast.error(r.error);
                          else toast.success("File deleted.");
                        });
                      }}
                      className="ml-auto rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
