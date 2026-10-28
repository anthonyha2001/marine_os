import { Suspense } from "react";
import { redirect } from "next/navigation";

async function RedirectToDashboard({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  redirect(`/c/${company}/dashboard`);
  return null;
}

export default function CompanyIndex({ params }: PageProps<"/c/[company]">) {
  return (
    <Suspense>
      <RedirectToDashboard params={params} />
    </Suspense>
  );
}
