import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSite } from "@/lib/data/website";
import { isCompanySlug } from "@/lib/permissions";
import { siteForHost } from "@/lib/site-domains";

/**
 * Everything a website page needs: the site's content, the base for links ("" on the company's
 * own domain, "/site/<company>" on the test address), and whether to show it. An unpublished
 * site shows "coming soon" to visitors; logged-in staff see it, to preview before publishing.
 */
export async function siteContext(params: Promise<{ company: string }>) {
  const { company } = await params;
  if (!isCompanySlug(company)) notFound();
  const [site, h, user] = await Promise.all([getSite(company), headers(), getCurrentUser()]);
  const onOwnDomain = siteForHost(h.get("host")) === company;
  return { site, base: onOwnDomain ? "" : `/site/${company}`, visible: site.published || !!user, preview: !site.published && !!user };
}

export const ACCENT = {
  "xpert-marine": { accent: "#1565c0", accentSoft: "#e8f0fb", dark: "#0b1f3a", darker: "#071429" },
  "eliche-radice": { accent: "#a8692a", accentSoft: "#f7efe6", dark: "#141b2d", darker: "#0c1120" },
} as const;

export const whatsappLink = (number: string | null, text?: string) => {
  if (!number) return null;
  let digits = number.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `961${digits.slice(1)}`;
  else if (digits.length <= 8) digits = `961${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};
