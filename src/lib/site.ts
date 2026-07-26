/**
 * Some hosts (GitHub Pages) serve this site under a subpath like /Beta.V2/;
 * most (Netlify, Cloudflare Pages, a custom domain) serve it at the root.
 * next/link and next/image auto-prepend this to their own URLs, but a
 * plain <a href> to a static file outside the Next app (the ported V1
 * board/map/pins pages living in public/) needs it added by hand — this is
 * the single source of truth, also imported by next.config.ts.
 *
 * Defaults to "" (root) for Netlify/Cloudflare Pages/custom domains. Set
 * NEXT_PUBLIC_BASE_PATH=/Beta.V2 only if deploying to GitHub Pages again.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
