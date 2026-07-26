import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/site";

// Static export — no server at request time, so all data access happens
// client-side against Supabase directly (anon key + RLS). Defaults to
// root-domain hosting (Netlify, Cloudflare Pages); set NEXT_PUBLIC_BASE_PATH
// only if deploying under a subpath (e.g. GitHub Pages). See README.
const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH || undefined,
  assetPrefix: BASE_PATH ? `${BASE_PATH}/` : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
