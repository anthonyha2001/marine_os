import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { getSite, websiteMessages } from "@/lib/data/website";
import { COMPANIES } from "@/lib/permissions";
import { Badge, PageHeader, secondaryButton } from "@/components/ui";
import { GalleryEditor, Inbox, ProductsEditor, PublishToggle, ServicesEditor, SettingsForm } from "./editor";

const TABS = [
  ["texts", "Texts & contact"],
  ["services", "Services"],
  ["products", "Products"],
  ["gallery", "Gallery"],
  ["messages", "Messages"],
] as const;
type Tab = (typeof TABS)[number][0];

async function Editor({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "marketing");
  const tab: Tab = TABS.some(([k]) => k === search.tab) ? (search.tab as Tab) : "texts";
  const [site, messages] = await Promise.all([getSite(slug), websiteMessages(slug)]);
  const unread = messages.filter((m) => m.status === "NEW").length;
  const base = `/c/${slug}/marketing/website`;

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Marketing`}
        title="Website"
        description="Change the texts and photos of your website. Products are listed from the system automatically."
        action={
          <>
            <a href={`/site/${slug}`} target="_blank" rel="noopener" className={secondaryButton}>
              <ExternalLink className="size-4" aria-hidden /> {site.published ? "Open website" : "Preview"}
            </a>
            <PublishToggle companySlug={slug} published={site.published} />
          </>
        }
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Badge tone={site.published ? "green" : "amber"}>{site.published ? "Published" : "Not published"}</Badge>
        <span>
          {site.published ? "Visitors see your website." : "Visitors see “coming soon”. You can preview it while logged in."} Test address:{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">/site/{slug}</code>
        </span>
      </div>

      <nav className="mt-6 flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Website sections">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`${base}?tab=${key}`}
            scroll={false}
            aria-current={tab === key ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === key ? "border-brand text-brand" : "border-transparent text-muted hover:text-navy"}`}
          >
            {label}
            {key === "messages" && unread > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">{unread}</span>}
            {key === "products" && <span className="ml-1.5 text-xs text-muted">{site.listings.length}</span>}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "texts" && <SettingsForm companySlug={slug} raw={site.raw} site={site} />}
        {tab === "services" && <ServicesEditor companySlug={slug} services={site.services} />}
        {tab === "products" && <ProductsEditor companySlug={slug} products={site.catalogue} />}
        {tab === "gallery" && <GalleryEditor companySlug={slug} items={site.gallery} />}
        {tab === "messages" && (
          <Inbox
            companySlug={slug}
            messages={messages.map((m) => ({
              id: m.id,
              kind: m.kind,
              name: m.name,
              email: m.email,
              phone: m.phone,
              message: m.message,
              productName: m.productName,
              status: m.status,
              handledByName: m.handledByName,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        )}
      </div>
    </>
  );
}

export default function WebsitePage({ params, searchParams }: PageProps<"/c/[company]/marketing/website">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Editor params={params} searchParams={searchParams as Promise<{ tab?: string }>} />
    </Suspense>
  );
}
