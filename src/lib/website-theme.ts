// Website design settings (Marketing → Website → Design), stored in WebsiteSettings.theme.
// Shared by the editor (client) and the public site (server).

export const HEADING_FONTS = { playfair: "Playfair Display", cormorant: "Cormorant", marcellus: "Marcellus", dmserif: "DM Serif Display" } as const;
export const BODY_FONTS = { inter: "Inter", manrope: "Manrope", jost: "Jost" } as const;

export type Theme = {
  navy: string; // deep background, headings
  gold: string; // accent: buttons, lines, highlights
  cream: string; // light section background
  ink: string; // body text on light sections
  headingFont: keyof typeof HEADING_FONTS;
  bodyFont: keyof typeof BODY_FONTS;
  corners: "sharp" | "soft" | "round";
  buttons: "glow" | "solid" | "outline";
  motion: "full" | "calm" | "off";
  header: "glass" | "solid";
};

export const DEFAULT_THEME: Theme = {
  navy: "#0A1929",
  gold: "#D4AF37",
  cream: "#F7F3EA",
  ink: "#1F2937",
  headingFont: "playfair",
  bodyFont: "inter",
  corners: "soft",
  buttons: "glow",
  motion: "full",
  header: "glass",
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T) => (allowed.includes(v as T) ? (v as T) : fallback);

/** A saved theme, with anything missing or invalid replaced by the default. */
export function readTheme(raw: unknown): Theme {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const color = (k: "navy" | "gold" | "cream" | "ink") => (typeof t[k] === "string" && HEX.test(t[k] as string) ? (t[k] as string) : DEFAULT_THEME[k]);
  return {
    navy: color("navy"),
    gold: color("gold"),
    cream: color("cream"),
    ink: color("ink"),
    headingFont: pick(t.headingFont, Object.keys(HEADING_FONTS) as (keyof typeof HEADING_FONTS)[], DEFAULT_THEME.headingFont),
    bodyFont: pick(t.bodyFont, Object.keys(BODY_FONTS) as (keyof typeof BODY_FONTS)[], DEFAULT_THEME.bodyFont),
    corners: pick(t.corners, ["sharp", "soft", "round"] as const, DEFAULT_THEME.corners),
    buttons: pick(t.buttons, ["glow", "solid", "outline"] as const, DEFAULT_THEME.buttons),
    motion: pick(t.motion, ["full", "calm", "off"] as const, DEFAULT_THEME.motion),
    header: pick(t.header, ["glass", "solid"] as const, DEFAULT_THEME.header),
  };
}

export const CORNER_RADIUS = { sharp: "0px", soft: "14px", round: "28px" } as const;
