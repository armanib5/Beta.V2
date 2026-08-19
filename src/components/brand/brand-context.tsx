"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { BrandAssets } from "@/lib/brand-assets";
import {
  AppLogo,
  EMPTY_BRAND_ASSETS,
  UltimatePin,
  Wordmark,
} from "@/components/brand/brand-mark";

/**
 * Carries the brand artwork resolved at build time down to every mark on
 * the Home Screen, so no component has to know where the files live.
 */
const BrandContext = createContext<BrandAssets>(EMPTY_BRAND_ASSETS);

export function BrandProvider({
  assets,
  children,
}: {
  assets: BrandAssets;
  children: ReactNode;
}) {
  return <BrandContext.Provider value={assets}>{children}</BrandContext.Provider>;
}

export function useBrandAssets() {
  return useContext(BrandContext);
}

/** The Ultimate Pin, wired to the resolved brand assets. */
export function Pin({
  className,
  style,
  title,
  decorative = false,
}: {
  className?: string;
  style?: CSSProperties;
  title?: string;
  decorative?: boolean;
}) {
  const { pin } = useBrandAssets();
  return (
    <UltimatePin src={pin} className={className} style={style} title={title} decorative={decorative} />
  );
}

/** The CityPinned app logo, wired to the resolved brand assets. */
export function AppMark({ className, decorative }: { className?: string; decorative?: boolean }) {
  const { appLogo } = useBrandAssets();
  return <AppLogo src={appLogo} className={className} decorative={decorative} />;
}

/** The CityPinned wordmark, wired to the resolved brand assets. */
export function WordMark({ className, decorative }: { className?: string; decorative?: boolean }) {
  const { wordmark } = useBrandAssets();
  return <Wordmark src={wordmark} className={className} decorative={decorative} />;
}
