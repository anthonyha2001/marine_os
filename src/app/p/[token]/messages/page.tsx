import { Suspense } from "react";
import Link from "next/link";
import { MessageCircle, Plus } from "lucide-react";
import { portalCustomer, portalThreads, THREAD_TOPICS, type ThreadTopic } from "@/lib/data/portal";
import { COMPANIES } from "@/lib/permissions";
import { Badge, primaryButton } from "@/components/ui";
import { Card, Empty, PageHead } from "../_parts";

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" });

async function Messages({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const threads = await portalThreads(customer.id);
  return (
    <>
      <PageHead
        title="Messages"
        sub="Questions, quote requests and claims. Our answers appear here."
        action={
          <Link href={`/p/${token}/messages/new`} className={primaryButton}>
            <Plus className="size-4" aria-hidden /> New message
          </Link>
        }
      />
      <Card title="Conversations" icon={MessageCircle}>
        {threads.length === 0 ? (
          <Empty>No messages yet. Ask us anything: a price, a part, a problem with your boat.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/p/${token}/messages/${t.id}`} className={`flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-surface-2 ${t.customerUnread ? "bg-brand-soft/50" : ""}`}>
                  <span className="min-w-0">
                    <span className={`block truncate text-navy ${t.customerUnread ? "font-semibold" : "font-medium"}`}>{t.subject}</span>
                    <span className="block truncate text-xs text-muted">
                      {t.last ? `${t.last.fromCustomer ? "You" : t.last.authorName}: ${t.last.body}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-muted">{when.format(t.lastMessageAt)}</span>
                    <span className="flex items-center gap-1.5">
                      {t.customerUnread && <Badge tone="blue">New answer</Badge>}
                      <span className="text-xs text-muted">
                        {THREAD_TOPICS[t.topic as ThreadTopic] ?? t.topic} · {COMPANIES[t.company].name}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function PortalMessages({ params }: PageProps<"/p/[token]/messages">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Messages params={params} />
    </Suspense>
  );
}
