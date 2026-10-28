import { COMPANIES, type CompanySlug } from "@/lib/permissions";

export function CompanyLogo({ slug, className }: { slug: CompanySlug; className?: string }) {
  // Plain img: the Eliche Radice logo is AVIF and is served as-is.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={COMPANIES[slug].logo} alt={COMPANIES[slug].name} className={className} />;
}
