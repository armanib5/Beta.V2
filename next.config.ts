import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/site";

// Static export for GitHub Pages (https://armanib5.github.io/Beta.V2/) — no
// server at request time, so all data access happens client-side against
// Supabase directly (anon key + RLS). See README for the V2/V3 hosting plan.
const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  assetPrefix: `${BASE_PATH}/`,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
