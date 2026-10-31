import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { mediaUrl } from "@/lib/data/website";

// Small pieces shared by the Eliche Radice blocks.

/** Two layers of moving waves along a section edge. */
export function Waves({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  const path = "M0,32 C150,64 350,0 600,32 C850,64 1050,0 1200,32 L1200,80 L0,80 Z";
  return (
    <div className={`pointer-events-none absolute inset-x-0 ${flip ? "top-0 rotate-180" : "bottom-0"} h-16 overflow-hidden sm:h-20 ${className}`} aria-hidden>
      <svg className="er-wave absolute bottom-0 h-full w-[200%] opacity-40" viewBox="0 0 2400 80" preserveAspectRatio="none" style={{ "--er-wave-speed": "26s" } as React.CSSProperties}>
        <path d={path} fill="currentColor" />
        <path d={path} transform="translate(1200 0)" fill="currentColor" />
      </svg>
      <svg className="er-wave absolute bottom-0 h-full w-[200%]" viewBox="0 0 2400 80" preserveAspectRatio="none" style={{ "--er-wave-speed": "16s" } as React.CSSProperties}>
        <path d={path} transform="translate(0 10)" fill="currentColor" />
        <path d={path} transform="translate(1200 10)" fill="currentColor" />
      </svg>
    </div>
  );
}

export type Tone = "light" | "white" | "dark";
const TONES: Record<Tone, string> = {
  light: "bg-[var(--er-cream)] text-[var(--er-ink)]",
  white: "bg-white text-[var(--er-ink)]",
  dark: "bg-[var(--er-navy)] text-white/80",
};

export function Section({ tone = "white", className = "", children, id }: { tone?: unknown; className?: string; children: React.ReactNode; id?: string }) {
  const t = (["light", "white", "dark"].includes(tone as string) ? tone : "white") as Tone;
  return (
    <section id={id} data-tone={t} className={`group/section relative overflow-hidden ${TONES[t]} ${className}`}>
      {t === "dark" && <div className="er-caustics pointer-events-none absolute inset-0" aria-hidden />}
      <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">{children}</div>
    </section>
  );
}

export function Heading({ eyebrow, title, intro, center = false }: { eyebrow?: unknown; title?: unknown; intro?: unknown; center?: boolean }) {
  if (!eyebrow && !title && !intro) return null;
  return (
    <div className={`er-reveal mb-12 max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      {eyebrow ? (
        <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--er-gold)] ${center ? "justify-center" : ""}`}>
          <span className="h-px w-8 bg-[var(--er-gold)]" aria-hidden /> {String(eyebrow)}
        </p>
      ) : null}
      {title ? <h2 className="mt-4 whitespace-pre-line font-[family-name:var(--er-heading)] text-4xl leading-[1.1] text-[var(--er-navy)] group-data-[tone=dark]/section:text-white sm:text-5xl">{String(title)}</h2> : null}
      {intro ? <p className="mt-5 text-lg leading-relaxed opacity-80">{String(intro)}</p> : null}
    </div>
  );
}

/** A themed button (gold glow, solid or outline, as chosen in Design). */
export function Button({ href, label, variant = "primary", base }: { href?: unknown; label?: unknown; variant?: "primary" | "secondary"; base: string }) {
  if (!label || !href) return null;
  const to = resolveLink(String(href), base);
  const cls =
    variant === "primary"
      ? "er-glow bg-[var(--er-gold)] text-[var(--er-navy)] [[data-buttons=outline]_&]:bg-transparent [[data-buttons=outline]_&]:text-[var(--er-gold)] [[data-buttons=outline]_&]:ring-1 [[data-buttons=outline]_&]:ring-[var(--er-gold)]"
      : "border border-current/30 backdrop-blur hover:border-[var(--er-gold)] hover:text-[var(--er-gold)]";
  const external = /^(https?:|mailto:|tel:)/.test(to);
  const inner = (
    <>
      {String(label)}
      <ArrowRight className="size-4 transition-transform duration-300 group-hover/btn:translate-x-1" aria-hidden />
    </>
  );
  const className = `group/btn inline-flex items-center gap-2.5 rounded-[var(--er-radius)] px-7 py-3.5 text-sm font-semibold tracking-wide transition ${cls}`;
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
