import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homePath } from "@/lib/permissions";

async function RedirectHome() {
  const user = await getCurrentUser();
  redirect(user ? homePath(user) : "/login");
  return null;
}

export default function Home() {
  return (
    <Suspense>
      <RedirectHome />
    </Suspense>
  );
}
