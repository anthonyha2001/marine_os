"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, EyeOff, ImagePlus, Mail, MessageCircle, Pencil, Phone, Star, Trash2, X } from "lucide-react";
import {
  deleteGalleryItem,
  deleteWebsiteService,
  moveWebsiteItem,
  saveDefaultServices,
  saveGalleryItem,
  saveListing,
  saveWebsiteService,
  saveWebsiteSettings,
  setListingFlag,
  setMessageHandled,
  setWebsitePublished,
  uploadWebsiteImage,
  type WebsiteFormState,
} from "@/lib/actions/website";
import type { SiteData } from "@/lib/data/website";
import { useFeedback } from "@/components/feedback";
import { FormMessage, Kbd, cardClass, inputClass, labelClass, primaryButton, secondaryButton, secondaryButtonSm } from "@/components/ui";

const media = (id: string | null | undefined) => (id ? `/site-media/${id}` : null);

/** Shrink a photo in the browser (longest side 1600 px, JPEG) so uploads are small and fast. */
async function resize(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("resize"))), "image/jpeg", 0.85));
  return { blob, width: canvas.width, height: canvas.height };
}

/** Upload a picture and keep its id in a hidden field (name). */
export function ImagePicker({ companySlug, name, initial, label, aspect = "aspect-video" }: { companySlug: string; name: string; initial: string | null; label: string; aspect?: string }) {
  const [id, setId] = useState(initial);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useFeedback();
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const { blob, width, height } = await resize(file);
      const fd = new FormData();
      fd.set("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      fd.set("width", String(width));
      fd.set("height", String(height));
      const res = await uploadWebsiteImage(companySlug, fd);
      if (res.error || !res.id) toast.error(res.error ?? "The picture couldn't be uploaded.");
      else setId(res.id);
    } catch {
      toast.error("This file can't be read as a picture.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className={labelClass}>
      {label}
      <input type="hidden" name={name} value={id ?? ""} />
      <div className={`relative mt-1.5 overflow-hidden rounded-lg border border-dashed border-border bg-surface-2 ${aspect}`}>
        {id ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media(id)!} alt="" className="size-full object-cover" />
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex size-full flex-col items-center justify-center gap-1 text-sm text-muted hover:text-brand">
            <ImagePlus className="size-6" aria-hidden /> {busy ? "Uploading…" : "Add a photo"}
          </button>
        )}
        {id && (
          <div className="absolute right-2 top-2 flex gap-1">
            <button type="button" onClick={() => input.current?.click()} className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-navy shadow">
              {busy ? "Uploading…" : "Change"}
            </button>
            <button type="button" onClick={() => setId(null)} className="rounded-md bg-white/90 p-1 text-danger shadow" aria-label="Remove photo">
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

export function PublishToggle({ companySlug, published }: { companySlug: string; published: boolean }) {
  const [pending, start] = useTransition();
  const { confirm, toast } = useFeedback();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (published && !(await confirm({ title: "Unpublish the website?", message: "Visitors will see a “coming soon” page until you publish again.", confirmLabel: "Unpublish", tone: "danger" }))) return;
        start(async () => {
          const res = await setWebsitePublished(companySlug, !published);
          if (res.error) toast.error(res.error);
          else toast.success(published ? "Website hidden." : "Website published.");
        });
      }}
      className={published ? secondaryButton : primaryButton}
    >
      {pending ? "Saving…" : published ? "Unpublish" : "Publish website"}
    </button>
  );
}

// ── Texts & contact ──

type Raw = SiteData["raw"];

export function SettingsForm({ companySlug, raw, site }: { companySlug: string; raw: Raw; site: SiteData }) {
  const [state, action, pending] = useActionState<WebsiteFormState, FormData>(saveWebsiteSettings.bind(null, companySlug), {});
  const text = (name: keyof NonNullable<Raw>, label: string, placeholder?: string | null, rows = 0, hint?: string) => (
    <label className={labelClass}>
      {label}
      {rows ? (
        <textarea name={name} rows={rows} defaultValue={(raw?.[name] as string | null) ?? ""} placeholder={placeholder ?? ""} className={inputClass} />
      ) : (
        <input name={name} defaultValue={(raw?.[name] as string | null) ?? ""} placeholder={placeholder ?? ""} className={inputClass} />
      )}
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
  const highlightsText = site.highlights.map((h) => `${h.title} | ${h.body}`).join("\n");
  return (
    <form action={action} data-save-shortcut className="space-y-6">
      <p className="text-sm text-muted">Empty boxes use the suggested text shown in grey. Type over it to use your own.</p>
      <section className={`${cardClass} grid gap-4 p-5 lg:grid-cols-[1fr_20rem]`}>
        <div className="space-y-4">
          <h2 className="font-semibold text-navy">Home page</h2>
          {text("tagline", "Tagline (top of the site)", site.tagline)}
          {text("heroTitle", "Main title", site.heroTitle)}
          {text("heroText", "Introduction", site.heroText, 3)}
          {text("highlights", "Three strong points", highlightsText, 3, "One per line: Title | short text")}
        </div>
        <ImagePicker companySlug={companySlug} name="heroImageId" initial={raw?.heroImageId ?? null} label="Main photo (home page)" aspect="aspect-[4/5]" />
      </section>

      <section className={`${cardClass} grid gap-4 p-5 lg:grid-cols-[1fr_20rem]`}>
        <div className="space-y-4">
          <h2 className="font-semibold text-navy">About page</h2>
          {text("aboutTitle", "Title", site.aboutTitle)}
          {text("aboutText", "Your story", site.aboutText, 8, "Leave an empty line between paragraphs.")}
        </div>
        <ImagePicker companySlug={companySlug} name="aboutImageId" initial={raw?.aboutImageId ?? null} label="About photo" aspect="aspect-[4/5]" />
      </section>

      <section className={`${cardClass} grid gap-4 p-5 sm:grid-cols-2`}>
        <h2 className="font-semibold text-navy sm:col-span-2">Contact details</h2>
        {text("phone", "Phone", site.phone)}
        {text("whatsapp", "WhatsApp number", "e.g. 03 123 456", 0, "Shows a WhatsApp button on every page.")}
        {text("email", "Email", site.email)}
        {text("mapQuery", "Place on the map", site.mapQuery, 0, "An address or place name, e.g. “Jounieh marina, Lebanon”.")}
        {text("address", "Address", site.address, 2)}
        {text("openingHours", "Opening hours", "Mon–Fri 8:00–17:00\nSat 8:00–13:00", 2, "One line each.")}
        {text("facebook", "Facebook page", "https://facebook.com/…")}
        {text("instagram", "Instagram", "https://instagram.com/…")}
        {text("linkedin", "LinkedIn", "https://linkedin.com/company/…")}
      </section>

      <section className={`${cardClass} grid gap-4 p-5 sm:grid-cols-2`}>
        <h2 className="font-semibold text-navy sm:col-span-2">Pages and search engines</h2>
        <div className="space-y-2 sm:col-span-2">
          {(
            [
              ["showCatalogue", "Show the product catalogue (no prices, “Ask for a quote”)", site.showCatalogue],
              ["showGallery", "Show the gallery", site.showGallery],
              ["showBooking", "Show “Book a service” (requests arrive in Appointments)", site.showBooking],
            ] as const
          ).map(([name, label, on]) => (
            <label key={name} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={name} defaultChecked={on} className="size-4 accent-brand" />
              {label}
            </label>
          ))}
        </div>
        {text("seoTitle", "Title in Google", site.seoTitle)}
        {text("seoDescription", "Description in Google", site.seoDescription, 2)}
      </section>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <span className="text-sm">{state.saved ? <span className="text-success">Saved. The website is updated.</span> : <FormMessage error={state.error} />}</span>
        <button type="submit" disabled={pending} className={`${primaryButton} gap-2`}>
          {pending ? "Saving…" : "Save"} <Kbd className="border-white/30 bg-white/10 text-white">Ctrl S</Kbd>
        </button>
      </div>
    </form>
  );
}

// ── Services ──

function ServiceForm({ companySlug, service, defaults, onDone }: { companySlug: string; service?: SiteData["services"][number]; defaults?: string; onDone?: () => void }) {
  const [version, setVersion] = useState(0);
  const [state, action, pending] = useActionState<WebsiteFormState, FormData>(async (prev: WebsiteFormState, fd: FormData) => {
    const res = await saveWebsiteService(companySlug, service && !service.isDefault ? service.id : null, prev, fd);
    if (res.saved) {
      onDone?.();
      if (!service) setVersion((v) => v + 1); // empty the form for the next one
    }
    return res;
  }, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_14rem]" key={version}>
      {defaults && <input type="hidden" name="defaults" value={defaults} />}
      <div className="space-y-3">
        <label className={labelClass}>
          Service title *
          <input name="title" required maxLength={120} defaultValue={service?.title ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Description *
          <textarea name="description" required rows={3} maxLength={1000} defaultValue={service?.description ?? ""} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={service?.published ?? true} className="size-4 accent-brand" />
          Show on the website
        </label>
        <FormMessage error={state.error} />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : service ? "Save service" : "Add service"}
        </button>
      </div>
      <ImagePicker companySlug={companySlug} name="imageId" initial={service?.imageId ?? null} label="Photo (optional)" aspect="aspect-[4/3]" />
    </form>
  );
}

export function ServicesEditor({ companySlug, services }: { companySlug: string; services: SiteData["services"] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { confirm, toast } = useFeedback();
  const suggestions = services.length > 0 && services.every((s) => s.isDefault);
  const defaults = suggestions ? JSON.stringify(services.map((s) => ({ title: s.title, description: s.description }))) : undefined;
  const run = (fn: () => Promise<{ error?: string }>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else if (ok) toast.success(ok);
    });
  return (
    <div className="space-y-6">
      {suggestions && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          These are suggested services shown until you add your own.
          <button type="button" disabled={pending} onClick={() => run(() => saveDefaultServices(companySlug, defaults!), "Suggestions saved: you can now edit them.")} className={secondaryButtonSm}>
            Keep them and edit
          </button>
        </div>
      )}
      <ul className="space-y-3">
        {services.map((s, i) => (
          <li key={s.id} className={`${cardClass} p-4`}>
            {editing === s.id ? (
              <ServiceForm companySlug={companySlug} service={s} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex gap-4">
                {s.imageId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media(s.imageId)!} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xs text-muted">No photo</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-navy">
                    {s.title} {!s.published && <span className="ml-1 text-xs font-normal text-muted">(hidden)</span>}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">{s.description}</p>
                </div>
                {!s.isDefault && (
                  <div className="flex shrink-0 items-start gap-1">
                    <button type="button" disabled={pending || i === 0} onClick={() => run(() => moveWebsiteItem(companySlug, "service", s.id, -1))} className="rounded-md p-1.5 text-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move up">
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" disabled={pending || i === services.length - 1} onClick={() => run(() => moveWebsiteItem(companySlug, "service", s.id, 1))} className="rounded-md p-1.5 text-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move down">
                      <ArrowDown className="size-4" />
                    </button>
                    <button type="button" onClick={() => setEditing(s.id)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-navy" aria-label={`Edit ${s.title}`}>
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={async () => {
                        if (await confirm({ title: `Remove “${s.title}”?`, message: "It disappears from the website.", confirmLabel: "Remove", tone: "danger" })) run(() => deleteWebsiteService(companySlug, s.id), "Service removed.");
                      }}
                      className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                      aria-label={`Remove ${s.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <section className={`${cardClass} p-5`}>
        <h2 className="mb-4 font-semibold text-navy">Add a service</h2>
        <ServiceForm companySlug={companySlug} defaults={defaults} />
      </section>
    </div>
  );
}

// ── Products (automatic) ──

function ProductRow({ companySlug, p }: { companySlug: string; p: SiteData["catalogue"][number] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useFeedback();
  const [state, action, saving] = useActionState<WebsiteFormState, FormData>(async (prev: WebsiteFormState, fd: FormData) => {
    const res = await saveListing(companySlug, p.productId, prev, fd);
    if (res.saved) setOpen(false);
    return res;
  }, {});
  const flag = (f: "hidden" | "featured", v: boolean) =>
    start(async () => {
      const res = await setListingFlag(companySlug, p.productId, f, v);
      if (res.error) toast.error(res.error);
    });
  return (
    <li className={`${cardClass} p-4 ${p.hidden ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-4">
        {media(p.imageId) ?? p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(media(p.imageId) ?? p.imageUrl)!} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[10px] text-muted">No photo</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy">{p.name}</p>
          <p className="text-xs text-muted">
            #{p.code} {p.hidden ? "· hidden from the website" : p.featured ? "· featured" : ""}
          </p>
        </div>
        <button type="button" disabled={pending} onClick={() => flag("featured", !p.featured)} title={p.featured ? "Remove from featured" : "Feature on the home page"} className={`rounded-md p-2 ${p.featured ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`} aria-pressed={p.featured} aria-label={`Feature ${p.name}`}>
          <Star className="size-5" fill={p.featured ? "currentColor" : "none"} />
        </button>
        <button type="button" disabled={pending} onClick={() => flag("hidden", !p.hidden)} className={secondaryButtonSm}>
          {p.hidden ? (
            <>
              <Check className="size-3.5" aria-hidden /> Show
            </>
          ) : (
            <>
              <EyeOff className="size-3.5" aria-hidden /> Hide
            </>
          )}
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className={secondaryButtonSm}>
          <Pencil className="size-3.5" aria-hidden /> Photo & text
        </button>
      </div>
      {open && (
        <form action={action} className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-[1fr_12rem]">
          <div className="space-y-3">
            <label className={labelClass}>
              Website description
              <textarea name="description" rows={4} maxLength={2000} defaultValue={p.ownDescription ?? ""} placeholder={p.description ?? "What it is, what it fits, why choose it…"} className={inputClass} />
            </label>
            <FormMessage error={state.error} />
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          <ImagePicker companySlug={companySlug} name="imageId" initial={p.imageId} label="Website photo" aspect="aspect-square" />
        </form>
      )}
    </li>
  );
}

export function ProductsEditor({ companySlug, products }: { companySlug: string; products: SiteData["catalogue"] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = products.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.code.includes(needle));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Products appear on the website by themselves: the ones this company has in stock or has bought. Add a photo and a description, feature the best ones
        on the home page, or hide what you don&apos;t want online. No prices are shown.
      </p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className={`${inputClass} max-w-sm`} />
      {shown.length === 0 ? (
        <p className={`${cardClass} p-8 text-center text-sm text-muted`}>{products.length ? "No product matches." : "No products yet. Products appear here once this company buys them or has them in stock."}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <ProductRow key={p.productId} companySlug={companySlug} p={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Gallery ──

function GalleryForm({ companySlug, item, onDone }: { companySlug: string; item?: SiteData["gallery"][number]; onDone?: () => void }) {
  const [version, setVersion] = useState(0);
  const [state, action, pending] = useActionState<WebsiteFormState, FormData>(async (prev: WebsiteFormState, fd: FormData) => {
    const res = await saveGalleryItem(companySlug, item?.id ?? null, prev, fd);
    if (res.saved) {
      onDone?.();
      if (!item) setVersion((v) => v + 1);
    }
    return res;
  }, {});
  return (
    <form action={action} key={version} className="grid gap-4 sm:grid-cols-[14rem_1fr]">
      <ImagePicker companySlug={companySlug} name="imageId" initial={item?.imageId ?? null} label="Photo *" aspect="aspect-[4/3]" />
      <div className="space-y-3">
        <label className={labelClass}>
          Title *
          <input name="title" required maxLength={120} defaultValue={item?.title ?? ""} placeholder="e.g. Twin 300 HP repower" className={inputClass} />
        </label>
        <label className={labelClass}>
          Caption
          <textarea name="caption" rows={2} maxLength={500} defaultValue={item?.caption ?? ""} className={inputClass} />
        </label>
        <FormMessage error={state.error} />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : item ? "Save" : "Add to the gallery"}
        </button>
      </div>
    </form>
  );
}

export function GalleryEditor({ companySlug, items }: { companySlug: string; items: SiteData["gallery"] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { confirm, toast } = useFeedback();
  const run = (fn: () => Promise<{ error?: string }>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else if (ok) toast.success(ok);
    });
  return (
    <div className="space-y-6">
      <section className={`${cardClass} p-5`}>
        <h2 className="mb-4 font-semibold text-navy">Add a photo</h2>
        <GalleryForm companySlug={companySlug} />
      </section>
      {items.length === 0 ? (
        <p className="text-sm text-muted">No photos yet. Add boats you&apos;ve worked on and finished projects.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((g, i) => (
            <li key={g.id} className={`${cardClass} overflow-hidden`}>
              {editing === g.id ? (
                <div className="p-4">
                  <GalleryForm companySlug={companySlug} item={g} onDone={() => setEditing(null)} />
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={media(g.imageId)!} alt={g.title} className="aspect-[4/3] w-full object-cover" />
                  <div className="flex items-start gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-navy">{g.title}</p>
                      {g.caption && <p className="line-clamp-1 text-xs text-muted">{g.caption}</p>}
                    </div>
                    <button type="button" disabled={pending || i === 0} onClick={() => run(() => moveWebsiteItem(companySlug, "gallery", g.id, -1))} className="rounded-md p-1 text-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move earlier">
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" disabled={pending || i === items.length - 1} onClick={() => run(() => moveWebsiteItem(companySlug, "gallery", g.id, 1))} className="rounded-md p-1 text-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Move later">
                      <ArrowDown className="size-4" />
                    </button>
                    <button type="button" onClick={() => setEditing(g.id)} className="rounded-md p-1 text-muted hover:bg-surface-2" aria-label={`Edit ${g.title}`}>
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (await confirm({ title: `Remove “${g.title}”?`, message: "It disappears from the website gallery.", confirmLabel: "Remove", tone: "danger" })) run(() => deleteGalleryItem(companySlug, g.id), "Photo removed.");
                      }}
                      className="rounded-md p-1 text-muted hover:bg-red-50 hover:text-danger"
                      aria-label={`Remove ${g.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Inbox ──

type Message = { id: string; kind: string; name: string; email: string | null; phone: string | null; message: string; productName: string | null; status: string; handledByName: string | null; createdAt: string };
const KIND = { CONTACT: "Message", QUOTE: "Quote request", BOOKING: "Booking request" } as Record<string, string>;
const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Beirut" });

export function Inbox({ companySlug, messages }: { companySlug: string; messages: Message[] }) {
  const [pending, start] = useTransition();
  const wa = (phone: string) => {
    let d = phone.replace(/\D/g, "");
    if (d.startsWith("0")) d = `961${d.slice(1)}`;
    else if (d.length <= 8) d = `961${d}`;
    return `https://wa.me/${d}`;
  };
  if (!messages.length) return <p className={`${cardClass} p-8 text-center text-sm text-muted`}>No messages yet. Contact messages, quote requests and booking requests from the website arrive here.</p>;
  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <li key={m.id} className={`${cardClass} p-4 ${m.status === "HANDLED" ? "opacity-60" : "border-l-4 border-l-brand"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-navy">
                {m.name} <span className="ml-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">{KIND[m.kind] ?? m.kind}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {stamp.format(new Date(m.createdAt))}
                {m.productName && ` · ${m.productName}`}
                {m.status === "HANDLED" && m.handledByName && ` · handled by ${m.handledByName}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {m.phone && (
                <>
                  <a href={`tel:${m.phone}`} className={secondaryButtonSm}>
                    <Phone className="size-3.5" aria-hidden /> {m.phone}
                  </a>
                  <a href={wa(m.phone)} target="_blank" rel="noopener" className={secondaryButtonSm}>
                    <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
                  </a>
                </>
              )}
              {m.email && (
                <a href={`mailto:${m.email}`} className={secondaryButtonSm}>
                  <Mail className="size-3.5" aria-hidden /> Email
                </a>
              )}
              <button type="button" disabled={pending} onClick={() => start(async () => void (await setMessageHandled(companySlug, m.id, m.status !== "HANDLED")))} className={secondaryButtonSm}>
                <Check className="size-3.5" aria-hidden /> {m.status === "HANDLED" ? "Mark as new" : "Mark handled"}
              </button>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{m.message}</p>
        </li>
      ))}
    </ul>
  );
}
