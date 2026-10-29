// Company websites on their own domains. Once a domain points to this app, every page of it is
// served from /site/<company> (Marketing → Website). Until then the sites live at /site/<company>.
export const SITE_DOMAINS: Record<string, "xpert-marine" | "eliche-radice"> = {
  "xpertmarine.co": "xpert-marine",
  "www.xpertmarine.co": "xpert-marine",
  "elicheradicelb.com": "eliche-radice",
  "www.elicheradicelb.com": "eliche-radice",
};

export const siteForHost = (host: string | null) => SITE_DOMAINS[(host ?? "").split(":")[0].toLowerCase()];
