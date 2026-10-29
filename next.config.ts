import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF rendering (offers) runs in Node; keep the library out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // PDFs read the logos from disk; make sure hosted (serverless) functions include them.
  outputFileTracingIncludes: { "/c/**": ["./public/logos/**", "./public/fonts/**"], "/p/**": ["./public/logos/**", "./public/fonts/**"] },
  experimental: {
    // Product pictures are uploaded through a Server Action (default limit is 1 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    // A stray package-lock.json in the home folder would otherwise be picked as the root.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
