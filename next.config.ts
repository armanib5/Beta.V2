import type { NextConfig } from "next";

// Static export for GitHub Pages (https://armanib5.github.io/Beta.V2/) — no
// server at request time, so all data access happens client-side against
// Supabase directly (anon key + RLS). See README for the V2/V3 hosting plan.
const repoBasePath = "/Beta.V2";

const nextConfig: NextConfig = {
  output: "export",
  basePath: repoBasePath,
  assetPrefix: `${repoBasePath}/`,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
