"use client"; // Error boundaries must be Client Components

import { ErrorPanel } from "@/components/error-panel";

export default function ErrorBoundary({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} />;
}
