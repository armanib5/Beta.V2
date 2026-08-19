import { existsSync } from "node:fs";
import path from "node:path";
import { BASE_PATH } from "@/lib/site";

/**
 * Resolves the finalized CityPinned brand art from `public/brand/`.
 *
 * Server-only: this runs once at build time (the app is a static export),
 * so a brand file dropped into `public/brand/` is picked up on the next
 * build with no code change, and no missing-asset request is ever made
 * from the browser. Never import this from a Client Component.
 *
 * See public/brand/README.md for the expected filenames.
 */
export interface BrandAssets {
  /** URL of the Ultimate Pin artwork, or null while it is still missing. */
  pin: string | null;
  /** URL of the CityPinned app logo, or null while it is still missing. */
  appLogo: string | null;
  /** URL of the CityPinned wordmark, or null while it is still missing. */
  wordmark: string | null;
}

const EXTENSIONS = ["svg", "png", "webp"] as const;

function findAsset(basename: string): string | null {
  for (const extension of EXTENSIONS) {
    const file = `${basename}.${extension}`;
    if (existsSync(path.join(process.cwd(), "public", "brand", file))) {
      return `${BASE_PATH}/brand/${file}`;
    }
  }
  return null;
}

export function resolveBrandAssets(): BrandAssets {
  return {
    pin: findAsset("ultimate-pin"),
    appLogo: findAsset("app-logo"),
    wordmark: findAsset("wordmark"),
  };
}
