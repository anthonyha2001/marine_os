"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, ExternalLink, FileText, Plus, Settings2, Trash2, X } from "lucide-react";
import { addBlock, addPage, deleteBlock, deletePage, duplicateBlock, moveBlock, movePage, saveBlock, savePageSettings, setBlockHidden } from "@/lib/actions/website-pages";
import type { SitePage } from "@/lib/data/website";
import { BLOCKS, type BlockData, type BlockDef, type BlockType, type Field } from "@/lib/website-blocks";

const def = (t: BlockType): BlockDef => BLOCKS[t];
import { useFeedback } from "@/components/feedback";
import { Modal } from "@/components/modal";
import { Badge, Kbd, cardClass, inputClass, labelClass, primaryButton, secondaryButton, secondaryButtonSm } from "@/components/ui";
import { ImagePicker } from "./editor";

type Result = { error?: string; id?: string };

/** One sentence that tells blocks of the same type apart in the list. */
function summary(type: BlockType, d: BlockData) {
  const first = [d.title, d.eyebrow, d.text, d.intro].find((v) => typeof v === "string" && v.trim());
  if (first) return String(first).split("\n")[0].slice(0, 70);
  const items = Array.isArray(d.items) ? d.items.length : null;
  return items !== null ? `${items} item${items === 1 ? "" : "s"}` : BLOCKS[type].description;
}

/** Marketing → Website → Pages: pages on the left, their blocks, and the selected block's form. */
export function PagesEditor({ companySlug, pages, siteBase, saved }: { companySlug: string; pages: SitePage[]; siteBase: string; saved: boolean }) {
  const { toast, confirm } = useFeedback();
  const [pending, start] = useTransition();
  const [slug, setSlug] = useState(pages[0]?.slug ?? "");
  const [index, setIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null); // add a block after this index (-1 = at the top)
  const [settings, setSettings] = useState(false);
  const [newPage, setNewPage] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const page = pages.find((p) => p.slug === slug) ?? pages[0];
  const block = index !== null ? page?.blocks[index] : undefined;
  const pageUrl = `${siteBase}${page?.slug ? `/${page.slug}` : ""}`;

  const run = (fn: () => Promise<Result>, ok?: string, after?: (r: Result) => void) =>
    start(async () => {
      try {
        const r = await fn();
        if (r.error) return toast.error(r.error);
        if (ok) toast.success(ok);
        after?.(r);
        setPreviewKey((k) => k + 1);
      } catch {
        toast.error("That didn't work. Check your connection and try again.");
      }
    });

  if (!page) return null;
  return (
    <div className="space-y-4">
      {!saved && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
          These are the starter pages. Change anything and they become yours. Products, services, the gallery and your contact details come from the other tabs.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[14rem_20rem_1fr]">
        {/* Pages */}
        <section className={`${cardClass} h-fit overflow-hidden`}>
          <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <h2 className="text-sm font-semibold text-navy">Pages</h2>
            <button type="button" onClick={() => setNewPage(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              <Plus className="size-3.5" aria-hidden /> Page
            </button>
          </header>
          <ul className="p-1.5">
            {pages.map((p, i) => (
              <li key={p.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setSlug(p.slug);
                    setIndex(null);
                  }}
                  className={`flex flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${p.slug === page.slug ? "bg-brand-soft font-semibold text-navy" : "text-slate-700 hover:bg-surface-2"}`}
                >
                  <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  {!p.published && <span className="text-[10px] text-muted">hidden</span>}
                  {p.published && !p.inNav && p.slug !== "" && <span className="text-[10px] text-muted">not in menu</span>}
                </button>
                <span className="flex opacity-0 transition group-hover:opacity-100">
                  <button type="button" disabled={pending || i === 0} onClick={() => run(() => movePage(companySlug, p.id, -1))} aria-label={`Move ${p.title} up`} className="p-1 text-muted hover:text-navy disabled:opacity-30">
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" disabled={pending || i === pages.length - 1} onClick={() => run(() => movePage(companySlug, p.id, 1))} aria-label={`Move ${p.title} down`} className="p-1 text-muted hover:text-navy disabled:opacity-30">
                    <ArrowDown className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Blocks of the page */}
        <section className={`${cardClass} h-fit overflow-hidden`}>
          <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <h2 className="truncate text-sm font-semibold text-navy">{page.title}</h2>
            <span className="flex gap-1">
              <button type="button" onClick={() => setSettings(true)} title="Page settings" aria-label="Page settings" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-navy">
                <Settings2 className="size-4" />
              </button>
              <button type="button" onClick={() => setPreview((v) => !v)} title="Preview" aria-label="Preview" className={`rounded-md p-1.5 hover:bg-surface-2 ${preview ? "text-brand" : "text-muted hover:text-navy"}`}>
                <Eye className="size-4" />
              </button>
              <a href={pageUrl} target="_blank" rel="noopener" title="Open the page" aria-label="Open the page" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-navy">
                <ExternalLink className="size-4" />
              </a>
            </span>
          </header>
          <ol className="space-y-1 p-1.5">
            <li>
              <AddHere onClick={() => setAdding(-1)} />
            </li>
            {page.blocks.map((b, i) => (
              <li key={b.id}>
                <div className={`group flex items-center gap-1 rounded-md border px-2 py-2 ${index === i ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface-2"} ${b.hidden ? "opacity-55" : ""}`}>
                  <button type="button" onClick={() => setIndex(i)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
                      {BLOCKS[b.type].label}
                      {b.hidden && <Badge tone="gray">Hidden</Badge>}
                    </span>
                    <span className="block truncate text-sm text-navy">{summary(b.type, b.data)}</span>
                  </button>
                  <span className="flex shrink-0 flex-col opacity-60 group-hover:opacity-100">
                    <button type="button" disabled={pending || i === 0} onClick={() => run(() => moveBlock(companySlug, b.id, -1), undefined, () => index === i && setIndex(i - 1))} aria-label="Move up" className="p-0.5 text-muted hover:text-navy disabled:opacity-30">
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button type="button" disabled={pending || i === page.blocks.length - 1} onClick={() => run(() => moveBlock(companySlug, b.id, 1), undefined, () => index === i && setIndex(i + 1))} aria-label="Move down" className="p-0.5 text-muted hover:text-navy disabled:opacity-30">
                      <ArrowDown className="size-3.5" />
                    </button>
                  </span>
                </div>
                <AddHere onClick={() => setAdding(i)} />
              </li>
            ))}
          </ol>
        </section>

        {/* The selected block */}
        <section className={`${cardClass} h-fit`}>
          {block ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <h2 className="font-semibold text-navy">{BLOCKS[block.type].label}</h2>
                  <p className="text-xs text-muted">{BLOCKS[block.type].description}</p>
                </div>
                <span className="flex gap-1.5">
                  <button type="button" disabled={pending} onClick={() => run(() => setBlockHidden(companySlug, block.id, !block.hidden), block.hidden ? "Block shown." : "Block hidden.")} className={secondaryButtonSm}>
                    {block.hidden ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />} {block.hidden ? "Show" : "Hide"}
                  </button>
                  <button type="button" disabled={pending} onClick={() => run(() => duplicateBlock(companySlug, block.id), "Block duplicated.", () => setIndex((index ?? 0) + 1))} className={secondaryButtonSm}>
                    <Copy className="size-3.5" aria-hidden /> Duplicate
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={async () => {
                      if (await confirm({ title: `Delete this ${BLOCKS[block.type].label.toLowerCase()} block?`, message: "It disappears from the page. This can't be undone.", confirmLabel: "Delete", tone: "danger" }))
                        run(() => deleteBlock(companySlug, block.id), "Block deleted.", () => setIndex(null));
                    }}
                    className={`${secondaryButtonSm} text-danger`}
                    aria-label="Delete block"
                    title="Delete block"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </span>
              </header>
              {def(block.type).fromApp && <p className="border-b border-border bg-surface-2 px-4 py-2 text-xs text-muted">From Marine OS: {def(block.type).fromApp}.</p>}
              <BlockForm
                key={`${block.id}:${JSON.stringify(block.data)}`}
                companySlug={companySlug}
                type={block.type}
                data={block.data}
                pending={pending}
                onSave={(data) => run(() => saveBlock(companySlug, block.id, data), "Saved. The page is updated.")}
              />
            </>
          ) : (
            <div className="px-6 py-14 text-center text-sm text-muted">
              <p className="font-medium text-navy">Choose a block to edit it</p>
              <p className="mt-1">Or add one with the + between blocks. Use the arrows to reorder them.</p>
            </div>
          )}
        </section>
      </div>

      {preview && (
        <section className={`${cardClass} overflow-hidden`}>
          <header className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
            <span className="font-medium text-navy">Preview · {page.title}</span>
            <button type="button" onClick={() => setPreview(false)} aria-label="Close preview" className="text-muted hover:text-navy">
              <X className="size-4" />
            </button>
          </header>
          <iframe key={previewKey} src={pageUrl} title="Preview" className="h-[80vh] w-full border-0" />
        </section>
      )}

      {adding !== null && (
        <Modal title="Add a block" onClose={() => setAdding(null)} size="xl">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(BLOCKS) as BlockType[]).map((t) => (
              <button
                key={t}
                type="button"
                disabled={pending}
                data-nav-row
                onClick={() =>
                  run(() => addBlock(companySlug, page.id, t, adding >= 0 ? page.blocks[adding]?.id ?? null : null), `${BLOCKS[t].label} added.`, () => {
                    setIndex(adding + 1);
                    setAdding(null);
                  })
                }
                className="rounded-xl border border-border bg-surface p-4 text-left transition hover:border-brand hover:shadow-md"
              >
                <span className="block font-semibold text-navy">{BLOCKS[t].label}</span>
                <span className="mt-1 block text-xs text-muted">{BLOCKS[t].description}</span>
                {def(t).fromApp && <span className="mt-2 block text-[11px] font-medium text-brand">Fed from Marine OS</span>}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {settings && <PageSettings companySlug={companySlug} page={page} pending={pending} onClose={() => setSettings(false)} run={run} onSlug={setSlug} />}

      {newPage && (
        <Modal title="New page" onClose={() => setNewPage(false)} size="md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const title = String(new FormData(e.currentTarget).get("title") ?? "");
              run(() => addPage(companySlug, title), "Page added.", () => {
                setNewPage(false);
                setSlug(title.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60));
                setIndex(0);
              });
            }}
            className="space-y-4"
          >
            <label className={labelClass}>
              Page name *
              <input name="title" required minLength={2} maxLength={80} autoFocus placeholder="e.g. Repowering" className={inputClass} />
            </label>
            <p className="text-xs text-muted">It starts with a title banner; add blocks after. It appears in the site menu (you can change that in its settings).</p>
            <button type="submit" disabled={pending} className={primaryButton}>
              Add the page
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AddHere({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group/add flex w-full items-center gap-2 px-2 py-0.5 text-[11px] text-transparent hover:text-brand focus-visible:text-brand" aria-label="Add a block here">
      <span className="h-px flex-1 bg-transparent group-hover/add:bg-brand/40" />
      <Plus className="size-3.5" aria-hidden /> Add a block
      <span className="h-px flex-1 bg-transparent group-hover/add:bg-brand/40" />
    </button>
  );
}

function PageSettings({
  companySlug,
  page,
  pending,
  onClose,
  run,
  onSlug,
}: {
  companySlug: string;
  page: SitePage;
  pending: boolean;
  onClose: () => void;
  run: (fn: () => Promise<Result>, ok?: string, after?: (r: Result) => void) => void;
  onSlug: (slug: string) => void;
}) {
  const { confirm } = useFeedback();
  const home = page.slug === "";
  return (
    <Modal title={`Page settings · ${page.title}`} onClose={onClose} size="md">
      <form
        data-save-shortcut
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const values = {
            title: String(f.get("title") ?? ""),
            slug: String(f.get("slug") ?? ""),
            inNav: f.get("inNav") === "on",
            published: f.get("published") === "on",
            seoTitle: String(f.get("seoTitle") ?? ""),
            seoDescription: String(f.get("seoDescription") ?? ""),
          };
          run(() => savePageSettings(companySlug, page.id, values), "Page saved.", () => {
            if (!home) onSlug(values.slug || values.title.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, ""));
            onClose();
          });
        }}
        className="space-y-4"
      >
        <label className={labelClass}>
          Name (in the menu)
          <input name="title" required defaultValue={page.title} maxLength={80} className={inputClass} />
        </label>
        {!home && (
          <label className={labelClass}>
            Address
            <span className="mt-1.5 flex items-center gap-1 text-sm text-muted">
              /<input name="slug" defaultValue={page.slug} maxLength={60} className={`${inputClass} mt-0`} />
            </span>
          </label>
        )}
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="inNav" defaultChecked={page.inNav} className="size-4 accent-brand" /> In the site menu
          </label>
          {!home && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="published" defaultChecked={page.published} className="size-4 accent-brand" /> Visible on the site
            </label>
          )}
        </div>
        <label className={labelClass}>
          Google title
          <input name="seoTitle" defaultValue={page.seoTitle ?? ""} maxLength={120} placeholder={page.title} className={inputClass} />
        </label>
        <label className={labelClass}>
          Google description
          <textarea name="seoDescription" defaultValue={page.seoDescription ?? ""} maxLength={300} rows={2} className={inputClass} />
        </label>
        <div className="flex items-center justify-between gap-2">
          {!home ? (
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (await confirm({ title: `Delete the page “${page.title}”?`, message: "Its blocks are deleted too. This can't be undone.", confirmLabel: "Delete page", tone: "danger" }))
                  run(() => deletePage(companySlug, page.id), "Page deleted.", () => {
                    onSlug("");
                    onClose();
                  });
              }}
              className={`${secondaryButton} text-danger`}
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={pending} className={`${primaryButton} gap-2`}>
            Save <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** A form for any block, built from the block's field list. */
function BlockForm({ companySlug, type, data, pending, onSave }: { companySlug: string; type: BlockType; data: BlockData; pending: boolean; onSave: (data: BlockData) => void }) {
  const [values, setValues] = useState<BlockData>(data);
  const [dirty, setDirty] = useState(false);
  const set = (key: string, v: unknown) => {
    setValues((x) => ({ ...x, [key]: v }));
    setDirty(true);
  };
  return (
    <form
      data-save-shortcut
      data-dirty={dirty ? "true" : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(values);
        setDirty(false);
      }}
      className="space-y-4 p-4"
    >
      {(BLOCKS[type].fields as Field[]).map((f) => (
        <FieldInput key={f.key} companySlug={companySlug} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
      ))}
      <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center justify-between gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <span className="text-xs text-muted">{dirty ? "Not saved yet" : "All saved"}</span>
        <button type="submit" disabled={pending || !dirty} className={`${primaryButton} gap-2`}>
          {pending ? "Saving…" : "Save block"} <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
      </div>
    </form>
  );
}

function FieldInput({ companySlug, field: f, value, onChange }: { companySlug: string; field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const hint = "hint" in f && f.hint ? <span className="mt-1 block text-[11px] font-normal text-muted">{f.hint}</span> : null;
  switch (f.type) {
    case "toggle":
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand" /> {f.label}
        </label>
      );
    case "select":
      return (
        <label className={labelClass}>
          {f.label}
          <select value={typeof value === "string" ? value : f.options[0][0]} onChange={(e) => onChange(e.target.value)} className={inputClass}>
            {f.options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {hint}
        </label>
      );
    case "image":
      return <ImagePicker key={typeof value === "string" ? value : "none"} companySlug={companySlug} name={`block-${f.key}`} initial={typeof value === "string" ? value : null} label={f.label} onChange={(id) => onChange(id)} />;
    case "textarea":
      return (
        <label className={labelClass}>
          {f.label}
          <textarea value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={4000} placeholder={f.placeholder} className={inputClass} />
          {hint}
        </label>
      );
    case "number":
      return (
        <label className={labelClass}>
          {f.label}
          <input type="number" value={typeof value === "number" ? value : value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={inputClass} />
          {hint}
        </label>
      );
    case "list":
      return <ListField companySlug={companySlug} field={f} value={Array.isArray(value) ? (value as BlockData[]) : []} onChange={onChange} />;
    default:
      return (
        <label className={labelClass}>
          {f.label}
          <input value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} maxLength={f.type === "text" ? 400 : 500} placeholder={f.placeholder} className={inputClass} />
          {hint}
        </label>
      );
  }
}

function ListField({ companySlug, field: f, value, onChange }: { companySlug: string; field: Extract<Field, { type: "list" }>; value: BlockData[]; onChange: (v: BlockData[]) => void }) {
  const update = (i: number, key: string, v: unknown) => onChange(value.map((row, n) => (n === i ? { ...row, [key]: v } : row)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const full = f.max !== undefined && value.length >= f.max;
  return (
    <fieldset className="rounded-lg border border-border">
      <legend className="ml-2 px-1 text-[13px] font-medium text-slate-700">{f.label}</legend>
      <div className="space-y-3 p-3">
        {value.length === 0 && <p className="text-xs text-muted">None yet.</p>}
        {value.map((row, i) => (
          <div key={i} className="rounded-lg bg-surface-2 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-navy">
                {f.itemLabel} {i + 1}
              </span>
              <span className="flex gap-0.5">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Up" className="p-1 text-muted hover:text-navy disabled:opacity-30">
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Down" className="p-1 text-muted hover:text-navy disabled:opacity-30">
                  <ArrowDown className="size-3.5" />
                </button>
                <button type="button" onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label={`Remove ${f.itemLabel.toLowerCase()} ${i + 1}`} className="p-1 text-muted hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {f.item.map((sub) => (
                <div key={sub.key} className={sub.type === "textarea" || sub.type === "image" ? "sm:col-span-2" : ""}>
                  <FieldInput companySlug={companySlug} field={sub} value={row[sub.key]} onChange={(v) => update(i, sub.key, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button type="button" disabled={full} onClick={() => onChange([...value, {}])} className={`${secondaryButtonSm} w-full justify-center`}>
          <Plus className="size-3.5" aria-hidden /> Add {f.itemLabel.toLowerCase()}
          {f.max ? <span className="text-muted">({value.length}/{f.max})</span> : null}
        </button>
      </div>
    </fieldset>
  );
}
