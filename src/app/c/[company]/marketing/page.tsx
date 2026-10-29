import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgePercent, Globe, Mail, MessageSquareQuote, Send, Share2 } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { getSite, unreadWebsiteMessages } from "@/lib/data/website";
import { COMPANIES } from "@/lib/permissions";
import { Badge, PageHeader, cardClass } from "@/components/ui";

// Marketing hub: one card per tool. The website is first; the others are built one by one.
const NEXT = [
  { icon: Share2, title: "Social media", text: "Plan and prepare posts for Facebook and Instagram from your products and projects." },
  { icon: Send, title: "Campaigns", text: "Email and WhatsApp messages to customer groups: season offers, service reminders." },
  { icon: BadgePercent, title: "Promotions", text: "Discount codes and seasonal offers, usable at the till and on quotes." },
  { icon: MessageSquareQuote, title: "Reviews", text: "Ask happy customers for a review after a job, and show the best ones on your website." },
  { icon: Mail, title: "Newsletter", text: "Collect subscribers on the website and send them news." },
];

async function Hub({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { slug } = await requireModule(company, "marketing");
  const [site, unread] = await Promise.all([getSite(slug), unreadWebsiteMessages(slug)]);
  const base = `/c/${slug}/marketing`;
  return (
    <>
      <PageHeader eyebrow={COMPANIES[slug].name} title="Marketing" description="Your tools to reach customers. Start with the website; more tools are coming one by one." />

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Link href={`${base}/website`} className={`${cardClass} group flex flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-lg`}>
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Globe className="size-5" aria-hidden />
            </span>
            <Badge tone={site.published ? "green" : "amber"}>{site.published ? "Published" : "Not published"}</Badge>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-navy">Website</h2>
          <p className="mt-1 flex-1 text-sm text-muted">Texts, photos, services and gallery of your public website. Products come from the system automatically.</p>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center text-sm">
            <div>
              <dt className="text-xs text-muted">Products</dt>
              <dd className="font-semibold text-navy">{site.listings.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Photos</dt>
              <dd className="font-semibold text-navy">{site.gallery.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">New messages</dt>
              <dd className={`font-semibold ${unread ? "text-danger" : "text-navy"}`}>{unread}</dd>
            </div>
          </dl>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
            Open the website editor <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
          </span>
        </Link>

        {NEXT.map((t) => (
          <div key={t.title} className={`${cardClass} flex flex-col p-6 opacity-75`}>
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-surface-2 text-muted">
                <t.icon className="size-5" aria-hidden />
              </span>
              <Badge tone="gray">Coming next</Badge>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-navy">{t.title}</h2>
            <p className="mt-1 text-sm text-muted">{t.text}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export default function MarketingPage({ params }: PageProps<"/c/[company]/marketing">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Hub params={params} />
    </Suspense>
  );
}
