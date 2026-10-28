import { BarChart3, FileCheck2, PackageSearch, ShieldCheck } from "lucide-react";
import { COMPANIES } from "@/lib/permissions";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Marine OS" };

const FEATURES = [
  { icon: FileCheck2, title: "Offers, invoices & payment terms", text: "Tender-grade PDFs with your letterhead." },
  { icon: PackageSearch, title: "Stock, purchase orders & suppliers", text: "From order to shelf, per company." },
  { icon: BarChart3, title: "Accounting at a glance", text: "What to collect, what to pay, what’s overdue." },
  { icon: ShieldCheck, title: "Role-based access", text: "Everyone sees exactly what their job needs." },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-[#071429] p-12 text-white lg:flex lg:flex-col">
        {/* Soft light + sea waves */}
        <div className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-[#1565c0]/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-48 right-0 size-[480px] rounded-full bg-[#a8692a]/20 blur-3xl" aria-hidden />
        <svg className="pointer-events-none absolute inset-x-0 bottom-0 w-full text-white/[0.04]" viewBox="0 0 1440 320" aria-hidden>
          <path fill="currentColor" d="M0,192L80,186.7C160,181,320,171,480,186.7C640,203,800,245,960,240C1120,235,1280,181,1360,154.7L1440,128L1440,320L0,320Z" />
          <path fill="currentColor" d="M0,256L120,245.3C240,235,480,213,720,218.7C960,224,1200,256,1320,272L1440,288L1440,320L0,320Z" />
        </svg>

        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M12 3v14M5 12a7 7 0 0 0 14 0M8 7h8M3 19c2 1.3 4 1.3 6 0s4-1.3 6 0 4 1.3 6 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">Marine OS</span>
        </div>

        <div className="relative mt-auto max-w-lg">
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight">
            Run both companies
            <br />
            from one workspace.
          </h1>
          <p className="mt-4 text-base text-blue-100/70">The operating system for Xpert Marine and Eliche Radice.</p>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] ring-1 ring-white/10">
                  <f.icon className="size-[18px] text-blue-200" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium">{f.title}</span>
                  <span className="block text-xs text-blue-100/60">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-12 flex items-center gap-3">
          {(["xpert-marine", "eliche-radice"] as const).map((slug) => (
            <span key={slug} className="flex h-14 w-36 items-center justify-center rounded-xl bg-white px-3 shadow-lg shadow-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element -- logos are served as-is */}
              <img src={COMPANIES[slug].mark} alt={COMPANIES[slug].name} className="max-h-10 w-auto object-contain" />
            </span>
          ))}
        </div>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            {(["xpert-marine", "eliche-radice"] as const).map((slug) => (
              /* eslint-disable-next-line @next/next/no-img-element -- logos are served as-is */
              <img key={slug} src={COMPANIES[slug].mark} alt={COMPANIES[slug].name} className="h-9 w-auto" />
            ))}
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-navy">Welcome back</h2>
          <p className="mt-1.5 text-sm text-muted">Sign in to your Marine OS account.</p>

          <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            No account yet? Your manager creates it from <span className="font-medium text-slate-600">Team &amp; roles</span>.
          </p>
        </div>
      </section>
    </main>
  );
}
