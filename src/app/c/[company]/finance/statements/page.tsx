import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StatementsContent, type Search } from "./statements-view";

export default function StatementsPage({ params, searchParams }: PageProps<"/c/[company]/finance/statements">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading statements…</p>}>
      <CustomerOrSupplier params={params} searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

/** Old links (?type=supplier) still land on the supplier statements, now under Purchasing. */
async function CustomerOrSupplier({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Search> }) {
  const [{ company }, search] = await Promise.all([params, searchParams]);
  if (search.type === "supplier") redirect(`/c/${company}/suppliers/statements?${new URLSearchParams(search as Record<string, string>)}`);
  return <StatementsContent params={params} searchParams={searchParams} kind="CUSTOMER" />;
}
