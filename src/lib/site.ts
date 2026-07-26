/**
 * GitHub Pages serves this site under /Beta.V2/. next/link and next/image
 * auto-prepend this to their own URLs, but a plain <a href> to a static
 * file outside the Next app (the ported V1 board/map/pins pages living in
 * public/) needs it added by hand — this is the single source of truth,
 * also imported by next.config.ts.
 */
export const BASE_PATH = "/Beta.V2";
