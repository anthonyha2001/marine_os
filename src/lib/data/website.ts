import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DATA_TAG } from "@/lib/cache-tag";
import { companyIdFor, tags } from "@/lib/data/inventory";
import { getCompanyProfile } from "@/lib/data/sales";
import { COMPANIES, type CompanySlug } from "@/lib/permissions";
import { STARTER_PAGES, blockData, isBlockType, type BlockData, type BlockType } from "@/lib/website-blocks";
import { readTheme } from "@/lib/website-theme";

// The public websites of both companies, edited in Marketing → Website. Every read is cached
// and refreshed by websiteTag when something is saved.

export const websiteTag = (companyId: string) => `website:${companyId}`;

/** Texts used until the company writes its own, so the site is never empty. */
const DEFAULTS: Record<CompanySlug, { tagline: string; heroTitle: string; heroText: string; aboutTitle: string; aboutText: string; highlights: string; services: { title: string; description: string }[] }> = {
  "xpert-marine": {
    tagline: "Engines · Parts · Maintenance",
    heroTitle: "Marine engines, parts and maintenance you can rely on",
    heroText: "Sales, installation and servicing of marine engines, genuine spare parts and full boat maintenance, from our workshop in Lebanon.",
    aboutTitle: "About Xpert Marine",
    aboutText:
      "Xpert Marine supplies and services marine engines for leisure and work boats. Our certified technicians handle installation, repowering, scheduled maintenance and repairs, with genuine parts and a warranty on our work.",
    highlights: "Certified technicians | Trained on the engines we sell and service\nGenuine parts | Original spare parts with warranty\nFast turnaround | Clear quotes and job tracking from start to finish",
    services: [
      { title: "Engine sales & repowering", description: "New inboard and outboard engines, sized for your boat and installed by our team." },
      { title: "Maintenance & servicing", description: "Scheduled servicing, winterisation and seasonal checks to keep your engines reliable." },
      { title: "Repairs & diagnostics", description: "Fault finding, mechanical and electrical repairs, in our workshop or at the marina." },
      { title: "Spare parts", description: "Genuine parts and consumables, in stock or ordered for you." },
    ],
  },
  "eliche-radice": {
    tagline: "Marine propellers",
    heroTitle: "Propellers built for performance",
    heroText: "Marine propellers, shafts and running gear: supply, fitting, repair and balancing for every type of boat.",
    aboutTitle: "About Eliche Radice",
    aboutText:
      "Eliche Radice Lebanon brings Italian propeller expertise to Lebanese waters. We help you choose the right propeller for your boat and keep it in top condition with repair, reconditioning and balancing.",
    highlights: "Expert advice | The right propeller for your hull and engine\nRepair & balancing | Restore performance and reduce vibration\nShop & counter | Parts and accessories ready to take away",
    services: [
      { title: "Propeller selection", description: "We match pitch, diameter and blades to your boat, engine and use." },
      { title: "Repair & reconditioning", description: "Straightening, welding, polishing and balancing of damaged propellers." },
      { title: "Shafts & running gear", description: "Shafts, couplings, bearings and anodes supplied and fitted." },
      { title: "Shop", description: "Marine parts and accessories at our counter." },
    ],
  },
};

const text = (v: string | null | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);

async function loadSite(slug: CompanySlug, companyId: string) {
  "use cache";
  cacheTag(DATA_TAG, websiteTag(companyId), tags.products, tags.stock(companyId), tags.purchases(companyId));
  cacheLife("hours");
  const [settings, services, gallery, products, overrides, profile, savedPages] = await Promise.all([
    prisma.websiteSettings.findUnique({ where: { companyId } }),
    prisma.websiteService.findMany({ where: { companyId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.websiteGalleryItem.findMany({ where: { companyId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    // The company's own products: those it holds in stock or has bought.
    prisma.product.findMany({
      where: { type: "PRODUCT", active: true, OR: [{ stockMovements: { some: { companyId } } }, { purchaseItems: { some: { purchase: { companyId } } } }] },
      select: { id: true, code: true, name: true, description: true, imageUrl: true },
      orderBy: { name: "asc" },
    }),
    prisma.websiteListing.findMany({ where: { companyId } }),
    getCompanyProfile(slug),
    prisma.websitePage.findMany({ where: { companyId }, orderBy: [{ position: "asc" }, { slug: "asc" }], include: { blocks: { orderBy: { position: "asc" } } } }),
  ]);
  // Until the company edits its pages, the starter pages show (nothing saved yet).
  const pages: SitePage[] = savedPages.length
    ? savedPages.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        inNav: p.inNav,
        published: p.published,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        blocks: p.blocks.filter((b) => isBlockType(b.type)).map((b) => ({ id: b.id, type: b.type as BlockType, hidden: b.hidden, data: blockData(b.type as BlockType, b.data) })),
      }))
    : STARTER_PAGES.map((p) => ({
        id: `starter-${p.slug || "home"}`,
        slug: p.slug,
        title: p.title,
        inNav: p.inNav,
        published: true,
        seoTitle: null,
        seoDescription: null,
        blocks: p.blocks.map((b, i) => ({ id: `starter-${p.slug || "home"}-${i}`, type: b.type, hidden: false, data: blockData(b.type, b.data) })),
      }));
  const byProduct = new Map(overrides.map((o) => [o.productId, o]));
  const catalogue = products.map((p) => {
    const o = byProduct.get(p.id);
    return {
      id: o?.id ?? p.id,
      productId: p.id,
      code: p.code,
      name: p.name,
      description: o?.description || p.description,
      ownDescription: o?.description ?? null,
      imageId: o?.imageId ?? null,
      imageUrl: p.imageUrl,
      featured: o?.featured ?? false,
      hidden: o?.hidden ?? false,
    };
  });
  const d = DEFAULTS[slug];
  const s = settings;
  return {
    slug,
    companyId,
    name: profile.name || COMPANIES[slug].name,
    logo: COMPANIES[slug].mark,
    published: s?.published ?? false,
    saved: !!s,
    tagline: text(s?.tagline, d.tagline),
    heroTitle: text(s?.heroTitle, d.heroTitle),
    heroText: text(s?.heroText, d.heroText),
    heroImageId: s?.heroImageId ?? null,
    aboutTitle: text(s?.aboutTitle, d.aboutTitle),
    aboutText: text(s?.aboutText, d.aboutText),
    aboutImageId: s?.aboutImageId ?? null,
    highlights: text(s?.highlights, d.highlights)
      .split("\n")
      .map((l) => l.split("|").map((x) => x.trim()))
      .filter(([t]) => t)
      .map(([title, body]) => ({ title, body: body ?? "" })),
    phone: s?.phone || profile.phone,
    whatsapp: s?.whatsapp || null,
    email: s?.email || profile.email,
    address: s?.address || profile.address,
    mapQuery: s?.mapQuery || s?.address || profile.address,
    openingHours: (s?.openingHours ?? "").split("\n").map((l) => l.trim()).filter(Boolean),
    facebook: s?.facebook || null,
    instagram: s?.instagram || null,
    linkedin: s?.linkedin || null,
    seoTitle: text(s?.seoTitle, `${profile.name || COMPANIES[slug].name} · ${text(s?.tagline, d.tagline)}`),
    seoDescription: text(s?.seoDescription, text(s?.heroText, d.heroText)),
    showCatalogue: s?.showCatalogue ?? true,
    showGallery: s?.showGallery ?? true,
    showBooking: s?.showBooking ?? true,
    raw: s,
    theme: readTheme(s?.theme),
    pages,
    pagesSaved: savedPages.length > 0,
    services: (services.length ? services : d.services.map((x, i) => ({ id: `default-${i}`, ...x, imageId: null, published: true, position: i }))).map((x) => ({
      id: x.id,
      title: x.title,
      description: x.description,
      imageId: x.imageId,
      published: x.published,
      position: x.position,
      isDefault: x.id.startsWith("default-"),
    })),
    gallery: gallery.map((g) => ({ id: g.id, title: g.title, caption: g.caption, imageId: g.imageId, published: g.published, position: g.position })),
    /** Everything the company sells, with the website settings (for the editor). */
    catalogue,
    /** What visitors see: not hidden, featured first. */
    listings: catalogue.filter((p) => !p.hidden).sort((a, b) => Number(b.featured) - Number(a.featured)),
  };
}

export type SiteData = Awaited<ReturnType<typeof loadSite>>;
export type SiteBlock = { id: string; type: BlockType; hidden: boolean; data: BlockData };
export type SitePage = { id: string; slug: string; title: string; inNav: boolean; published: boolean; seoTitle: string | null; seoDescription: string | null; blocks: SiteBlock[] };

/** A page of the site by its address ("" = home), if it exists and is published. */
export function findPage(site: SiteData, slug: string) {
  return site.pages.find((p) => p.slug === slug && p.published) ?? null;
}

export async function getSite(slug: CompanySlug) {
  return loadSite(slug, await companyIdFor(slug));
}

/** Messages from the website, newest first (not cached: the inbox must be live). */
export async function websiteMessages(slug: CompanySlug) {
  const companyId = await companyIdFor(slug);
  return prisma.websiteMessage.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 300 });
}

export async function unreadWebsiteMessages(slug: CompanySlug) {
  return prisma.websiteMessage.count({ where: { companyId: await companyIdFor(slug), status: "NEW" } });
}

/** URL of a website picture (served from the database, cached for a year). */
export const mediaUrl = (id: string | null | undefined) => (id ? `/site-media/${id}` : null);
