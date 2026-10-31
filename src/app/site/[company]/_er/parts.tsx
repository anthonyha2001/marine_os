import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { mediaUrl } from "@/lib/data/website";

// Small pieces shared by the Eliche Radice blocks: calm, editorial, professional.

export type Tone = "light" | "white" | "dark";
const TONES: Record<Tone, string> = {
  light: "bg-[var(--er-cream)] text-[var(--er-ink)]",
  white: "bg-white text-[var(--er-ink)]",
  dark: "bg-[var(--er-navy)] text-white/75",
};

export function Section({ tone = "white", className = "", children, id }: { tone?: unknown; className?: string; children: React.ReactNode; id?: string }) {
  const t = (["light", "white", "dark"].includes(tone as string) ? tone : "white") as Tone;
  return (
    <section id={id} data-tone={t} className={`group/section relative ${TONES[t]} ${className}`}>
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">{children}</div>
    </section>
  );
}

export function Heading({ eyebrow, title, intro, center = false }: { eyebrow?: unknown; title?: unknown; intro?: unknown; center?: boolean }) {
  if (!eyebrow && !title && !intro) return null;
  return (
    <div className={`er-reveal mb-12 max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--er-gold)]">{String(eyebrow)}</p> : null}
      {title ? (
        <h2 className="mt-3 whitespace-pre-line font-[family-name:var(--er-heading)] text-3xl leading-tight text-[var(--er-navy)] group-data-[tone=dark]/section:text-white sm:text-4xl">{String(title)}</h2>
      ) : null}
      {intro ? <p className="mt-4 text-base leading-relaxed opacity-75 sm:text-lg">{String(intro)}</p> : null}
    </div>
  );
}

/** A themed button: solid accent (main) or a quiet outline (second). */
export function Button({ href, label, variant = "primary", base }: { href?: unknown; label?: unknown; variant?: "primary" | "secondary"; base: string }) {
  if (!label || !href) return null;
  const to = resolveLink(String(href), base);
  const cls =
    variant === "primary"
      ? "bg-[var(--er-gold)] text-[var(--er-navy)] hover:brightness-95 [[data-buttons=outline]_&]:bg-transparent [[data-buttons=outline]_&]:text-[var(--er-gold)] [[data-buttons=outline]_&]:ring-1 [[data-buttons=outline]_&]:ring-inset [[data-buttons=outline]_&]:ring-[var(--er-gold)]"
      : "ring-1 ring-inset ring-current/25 hover:ring-current/60";
  const external = /^(https?:|mailto:|tel:)/.test(to);
  const inner = (
    <>
      {String(label)}
      <ArrowRight className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" aria-hidden />
    </>
  );
  const className = `group/btn inline-flex items-center gap-2 rounded-[var(--er-radius)] px-6 py-3 text-sm font-semibold transition ${cls}`;
  return external ? (
    <a href={to} className={className} target={to.startsWith("http") ? "_blank" : undefined} rel="noopener">
      {inner}
    </a>
  ) : (
    <Link href={to} className={className}>
      {inner}
    </Link>
  );
}

/** "/about" → the right address on the company's domain or on the test address. */
export function resolveLink(href: string, base: string) {
  if (/^(https?:|mailto:|tel:|#)/.test(href)) return href;
  const path = href.startsWith("/") ? href : `/${href}`;
  return `${base}${path === "/" ? "" : path}` || "/";
}

export const img = (id: unknown) => (typeof id === "string" && id ? mediaUrl(id) : null);

/** A video link → something a <video> or an <iframe> can show. */
export function videoSource(url: unknown): { kind: "file" | "embed"; src: string } | null {
  if (typeof url !== "string" || !url.trim()) return null;
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1` };
  const vimeo = u.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "embed", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return /^https?:\/\//.test(u) ? { kind: "file", src: u } : null;
}

export const list = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
