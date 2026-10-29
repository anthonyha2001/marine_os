import type { MetadataRoute } from "next";

/** Lets Marine OS be installed as an app (desktop, Android, iPhone home screen). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Marine OS",
    short_name: "Marine OS",
    description: "Xpert Marine and Eliche Radice: sales, stock, workshop, till, payroll and accounts.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#0b1f3a",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
