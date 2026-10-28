import Link from "next/link";

export const metadata = { title: "No access · Marine OS" };

export default function ForbiddenPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">403</p>
      <h1 className="mt-2 text-2xl font-semibold text-navy">You don&apos;t have access to this page</h1>
      <p className="mt-2 max-w-md text-muted">
        Your role doesn&apos;t include this company or section. If you think this is a mistake, ask your manager.
      </p>
      <Link href="/" className="mt-6 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">
        Back to my workspace
      </Link>
    </main>
  );
}
