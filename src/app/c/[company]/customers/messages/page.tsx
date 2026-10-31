import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { ExternalLink, MessageCircle } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { THREAD_TOPICS, type ThreadTopic } from "@/lib/data/portal";
import { getThread, listThreads, threadCounts } from "@/lib/data/portal-inbox";
import { COMPANIES } from "@/lib/permissions";
import { withParams } from "@/lib/url";
import { Modal } from "@/components/modal";
import { OpenRow } from "@/components/open-row";
import { Badge, EmptyState, PageHeader, cardClass, type Tone } from "@/components/ui";
import { LinkTabs } from "../../finance/finance-ui";
import { StaffReplyForm, ThreadStatusButton } from "./inbox-forms";

type Search = { show?: string; t?: string };
const TOPIC_TONE: Record<string, Tone> = { QUESTION: "blue", QUOTE: "green", CLAIM: "red", SERVICE: "amber", INFO: "gray" };
const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" });

async function Inbox({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "customers");
  const show = search.show === "closed" ? "closed" : search.show === "all" ? "all" : "open";
  const base = `/c/${slug}/customers/messages`;
  const here = withParams(base, { show: show === "open" ? null : show });
  const [threads, counts, thread] = await Promise.all([listThreads(slug, show), threadCounts(slug), search.t ? getThread(slug, search.t) : null]);

  // "Tell them on WhatsApp": a ready message with the link to the conversation in their portal.
  let whatsapp: string | null = null;
  if (thread?.customer.phone && thread.customer.portalToken) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
    const digits = thread.customer.phone.replace(/[^\d]/g, "").replace(/^0+/, "");
    const phone = digits.startsWith("961") ? digits : `961${digits}`;
    const text = `Hello ${thread.customer.name}, we answered your message "${thread.subject}":\n${origin}/p/${thread.customer.portalToken}/messages/${thread.id}\n\n${COMPANIES[slug].name}`;
    whatsapp = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Customers`}
        title="Messages from customers"
        description="Questions, quote requests, warranty claims and engine-hour updates sent from the customer portal. Answer here: the customer sees it in their portal."
      />
      <div className="mt-6">
        <LinkTabs
          active={show}
          tabs={[
            { key: "open", label: `Open (${counts.open})`, href: base },
            { key: "closed", label: "Closed", href: `${base}?show=closed` },
            { key: "all", label: "All", href: `${base}?show=all` },
          ]}
        />
      </div>
      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {threads.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No messages here" description="When a customer writes from their portal, it lands here." />
        ) : (
          <table className="w-full min-w-[44rem] text-left text-sm">
            <tbody className="divide-y divide-border">
              {threads.map((t) => (
                <OpenRow key={t.id} href={withParams(here, { t: t.id })} className={`hover:bg-background/60 ${t.staffUnread ? "bg-brand-soft/40" : ""}`}>
                  <td className="px-4 py-3">
                    <Link href={withParams(here, { t: t.id })} scroll={false} className={`block text-navy hover:underline ${t.staffUnread ? "font-semibold" : "font-medium"}`}>
                      {t.subject}
                    </Link>
                    <span className="line-clamp-1 block max-w-xl text-xs text-muted">{t.last ? `${t.last.fromCustomer ? t.customer.name : `You (${t.last.authorName})`}: ${t.last.body}` : ""}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/c/${slug}/customers/${t.customer.id}`} className="text-navy hover:underline">
                      {t.customer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={TOPIC_TONE[t.topic] ?? "gray"}>{THREAD_TOPICS[t.topic as ThreadTopic] ?? t.topic}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-muted">
                    {t.staffUnread && <span className="mr-2 inline-block size-2 rounded-full bg-danger align-middle" aria-label="New" />}
                    {when.format(t.lastMessageAt)}
                  </td>
                </OpenRow>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {thread && (
        <Modal title={thread.subject} closeHref={here} size="lg">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex flex-wrap items-center gap-2 text-muted">
                <Link href={`/c/${slug}/customers/${thread.customer.id}`} className="font-medium text-navy hover:underline">
                  {thread.customer.name}
                </Link>
                {thread.customer.phone && <span>· {thread.customer.phone}</span>}
                {thread.vessel && (
                  <Link href={`/c/${slug}/vessels/${thread.vessel.id}`} className="text-brand hover:underline">
                    · {thread.vessel.name}
                  </Link>
                )}
                {thread.warranty && (
                  <Link href={`/c/${slug}/warranties?w=${thread.warranty.id}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                    · {thread.warranty.number} <ExternalLink className="size-3" aria-hidden />
                  </Link>
                )}
              </span>
              <ThreadStatusButton companySlug={slug} threadId={thread.id} status={thread.status} />
            </div>
            <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-xl border border-border bg-surface p-4">
              {thread.messages.map((m) => (
                <div key={m.id} className={`flex ${m.fromCustomer ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.fromCustomer ? "rounded-bl-sm bg-surface-2 text-navy" : "rounded-br-sm bg-navy text-white"}`}>
                    <p className={`mb-1 text-[11px] ${m.fromCustomer ? "text-muted" : "text-white/70"}`}>
                      {m.authorName} · {when.format(m.createdAt)}
                    </p>
                    <p className="whitespace-pre-line">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <StaffReplyForm companySlug={slug} threadId={thread.id} whatsapp={whatsapp} />
          </div>
        </Modal>
      )}
    </>
  );
}

export default function CustomerMessagesPage({ params, searchParams }: PageProps<"/c/[company]/customers/messages">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading messages…</p>}>
      <Inbox params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
