import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { LIST_PAGE_SIZE } from "@/lib/data/lists";
import { letterPage } from "@/lib/data/letters";
import { COMPANIES } from "@/lib/permissions";
import { ButtonLink, PageHeader, SearchBar, cardClass } from "@/components/ui";
import { OpenRow } from "@/components/open-row";
import { Pager, pageFrom } from "@/components/pager";
import { withParams } from "@/lib/url";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

type Search = { q?: string; page?: string };

async function LettersContent({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, { q = "", page: pageParam }] = await Promise.all([params, searchParams]);
  const { slug } = await requireModule(company, "offers");
  const page = pageFrom(pageParam);
  const list = await letterPage(slug, q, page);
  const base = `/c/${slug}/letters`;

  return (
    <>
      <PageHeader
        eyebrow={COMPANIES[slug].name}
        title="Letters"
        description="Official letters on the company letterhead, to customers or anyone else."
        action={<ButtonLink icon={Plus} href={`${base}/new`}>New letter</ButtonLink>}
      />

      <div className="mt-6">
        <SearchBar action={base} defaultValue={q} placeholder="Search by number, addressee or subject" />
      </div>

      <div className={`${cardClass} mt-4 overflow-x-auto`}>
        {list.rows.length === 0 ? (
          <p className="p-10 text-center text-muted">{q ? "No letters match this search." : "No letters yet. Use New letter to write one."}</p>
        ) : (
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Offer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.rows.map((l) => (
                <OpenRow key={l.id} href={`${base}/${l.id}`} className="hover:bg-background/60">
                  <td className="px-4 py-3">
                    <Link href={`${base}/${l.id}`} className="font-mono font-medium text-brand hover:underline">
                      {l.number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{dateFormat.format(l.letterDate)}</td>
                  <td className="px-4 py-3 font-medium text-navy">{l.customerName}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-muted">{l.title}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted">{l.subject ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{l.offer?.number ?? "—"}</td>
                </OpenRow>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pager href={withParams(base, { q: q || null })} page={page} pageSize={LIST_PAGE_SIZE} total={list.total} />
    </>
  );
}

export default function LettersPage({ params, searchParams }: PageProps<"/c/[company]/letters">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading letters…</p>}>
      <LettersContent params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}
