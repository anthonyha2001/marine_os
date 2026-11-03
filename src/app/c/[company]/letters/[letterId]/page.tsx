import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { deleteLetter } from "@/lib/actions/letters";
import { getLetter } from "@/lib/data/letters";
import { COMPANIES, can, isAdmin } from "@/lib/permissions";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/ui";
import { LetterEditor } from "../letter-editor";
import { letterEditorData } from "../editor-data";
import { LetterToolbar } from "./letter-toolbar";

async function LetterPage({ params, searchParams }: { params: Promise<{ company: string; letterId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ company, letterId }, { saved }] = await Promise.all([params, searchParams]);
  const { user, slug } = await requireModule(company, "offers");
  const [letter, data] = await Promise.all([getLetter(slug, letterId), letterEditorData(slug)]);
  if (!letter) notFound();

  return (
    <>
      <PageHeader
        eyebrow={`${COMPANIES[slug].name} · Letter`}
        title={letter.number}
        description={[letter.customerName, letter.subject].filter(Boolean).join(" · ")}
        action={
          <div className="flex flex-wrap gap-2">
            <LetterToolbar companySlug={slug} letterId={letter.id} />
            {(isAdmin(user) || can(user, "deleteDrafts")) && (
              <DeleteButton
                bordered
                action={deleteLetter.bind(null, slug, letter.id)}
                confirmText={`Delete letter ${letter.number}? It goes to the recycle bin and can be restored.`}
                title="Delete letter"
              />
            )}
          </div>
        }
      />
      {letter.offer && (
        <p className="mt-4 text-sm text-muted">
          About offer{" "}
          <Link href={`/c/${slug}/offers/${letter.offer.id}`} className="font-mono text-brand hover:underline">
            {letter.offer.number}
          </Link>
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
          Letter saved.
        </p>
      )}
      {/* New key per render so the editor always shows what was just saved. */}
      <LetterEditor
        key={crypto.randomUUID()}
        companySlug={slug}
        companyName={data.company.legalName || COMPANIES[slug].name}
        customers={data.customers}
        offers={data.offers}
        userName={user.name}
        letter={{ ...letter, letterDate: letter.letterDate.toISOString().slice(0, 10) }}
      />
    </>
  );
}

export default function LetterDetailPage({ params, searchParams }: PageProps<"/c/[company]/letters/[letterId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <LetterPage params={params} searchParams={searchParams as Promise<{ saved?: string }>} />
    </Suspense>
  );
}
