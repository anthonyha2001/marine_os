import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { portalCustomer, portalThread, THREAD_TOPICS, type ThreadTopic } from "@/lib/data/portal";
import { COMPANIES } from "@/lib/permissions";
import { cardClass } from "@/components/ui";
import { PageHead } from "../../_parts";
import { ReplyForm } from "../../portal-forms";

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" });

async function Thread({ params, searchParams }: { params: Promise<{ token: string; threadId: string }>; searchParams: Promise<{ sent?: string }> }) {
  const [{ token, threadId }, search] = await Promise.all([params, searchParams]);
  const customer = await portalCustomer(token);
  if (!customer) return null;
  const thread = await portalThread(customer.id, threadId);
  if (!thread) notFound();
  return (
    <>
      <Link href={`/p/${token}/messages`} className="text-sm text-brand hover:underline">
        ← Messages
      </Link>
      <div className="mt-3 max-w-3xl">
        <PageHead title={thread.subject} sub={`${THREAD_TOPICS[thread.topic as ThreadTopic] ?? thread.topic} · ${COMPANIES[thread.company].name}${thread.status === "CLOSED" ? " · closed" : ""}`} />
        {search.sent && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-success">Sent. We&apos;ll answer here.</p>}
        <div className={`${cardClass} space-y-4 p-4 sm:p-5`}>
          {thread.messages.map((m) => (
            <div key={m.id} className={`flex ${m.fromCustomer ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.fromCustomer ? "rounded-br-sm bg-navy text-white" : "rounded-bl-sm bg-surface-2 text-navy"}`}>
                <p className={`mb-1 text-[11px] ${m.fromCustomer ? "text-white/70" : "text-muted"}`}>
                  {m.fromCustomer ? "You" : `${m.authorName} · ${COMPANIES[thread.company].name}`} · {when.format(m.createdAt)}
                </p>
                <p className="whitespace-pre-line">{m.body}</p>
              </div>
            </div>
          ))}
          <div className="border-t border-border pt-4">
            <ReplyForm token={token} threadId={thread.id} />
          </div>
        </div>
      </div>
    </>
  );
}

export default function PortalThread({ params, searchParams }: PageProps<"/p/[token]/messages/[threadId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Thread params={params} searchParams={searchParams as Promise<{ sent?: string }>} />
    </Suspense>
  );
}
