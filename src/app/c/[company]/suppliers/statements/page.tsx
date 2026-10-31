import { Suspense } from "react";
import { StatementsContent, type Search } from "../../finance/statements/statements-view";

export default function SupplierStatementsPage({ params, searchParams }: PageProps<"/c/[company]/suppliers/statements">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading statements…</p>}>
      <StatementsContent params={params} searchParams={searchParams as Promise<Search>} kind="SUPPLIER" />
    </Suspense>
  );
}
