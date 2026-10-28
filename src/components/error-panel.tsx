"use client";

import Link from "next/link";
import { primaryButton, secondaryButton } from "@/components/ui";

/**
 * Friendly replacement for a page that failed to load. Production builds hide the real error
 * message, and with a database this far away a dropped connection is by far the usual cause,
 * so the text says so and offers a retry that re-fetches the page.
 */
export function ErrorPanel({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-border bg-surface p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">Page not loaded</p>
      <h1 className="mt-2 text-xl font-semibold text-navy">This page couldn&apos;t be loaded</h1>
      <p className="mt-2 text-sm text-muted">
        This is usually a brief connection problem between your network and the database. Nothing was lost. Check your
        internet connection and press Try again.
      </p>
      <p className="mt-2 text-xs text-muted">If it keeps happening, tell your administrator and quote the reference below.</p>
      {error.digest && <p className="mt-3 font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-2">
        {/* retry() re-fetches the page from the server, which is what a dropped connection needs. */}
        <button type="button" onClick={retry} className={primaryButton}>
          Try again
        </button>
        <Link href="/" className={secondaryButton}>
          Go to my workspace
        </Link>
      </div>
    </div>
  );
}
