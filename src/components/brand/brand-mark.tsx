"use client";

import { useId, type CSSProperties } from "react";
import type { BrandAssets } from "@/lib/brand-assets";

/**
 * CityPinned brand marks.
 *
 * Each mark renders the finalized artwork from `public/brand/` when that
 * file exists (resolved at build time — see src/lib/brand-assets.ts) and
 * otherwise falls back to a deliberately plain geometric placeholder that
 * holds the correct footprint in the layout. The placeholders are marked
 * in their alt/title text and with `data-cp-placeholder`; they are not a
 * substitute logo. See public/brand/README.md for what is still needed.
 */

export const EMPTY_BRAND_ASSETS: BrandAssets = { pin: null, appLogo: null, wordmark: null };

/** The Ultimate Pin — the primary CityPinned symbol. */
export function UltimatePin({
  src,
  className,
  style,
  title,
  decorative = false,
}: {
  src: string | null;
  className?: string;
  style?: CSSProperties;
  title?: string;
  decorative?: boolean;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={decorative ? "" : (title ?? "CityPinned Ultimate Pin")}
        aria-hidden={decorative ? true : undefined}
        className={className}
        style={style}
        draggable={false}
      />
    );
  }
  return <PinPlaceholder className={className} style={style} decorative={decorative} />;
}

/** The CityPinned app logo, used where the app-icon element appears. */
export function AppLogo({
  src,
  className,
  decorative = true,
}: {
  src: string | null;
  className?: string;
  decorative?: boolean;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={decorative ? "" : "CityPinned app logo"}
        aria-hidden={decorative ? true : undefined}
        className={`${className ?? ""} object-contain`}
        draggable={false}
      />
    );
  }
  return (
    <span
      className={`cp-glass inline-flex items-center justify-center ${className ?? ""}`}
      style={{ borderRadius: "26%" }}
      data-cp-placeholder="app-logo"
      title="CityPinned app logo — placeholder, supply public/brand/app-logo.svg"
      aria-hidden="true"
    >
      <PinPlaceholder className="h-[70%] w-auto" decorative />
    </span>
  );
}

/** The CityPinned wordmark lockup. */
export function Wordmark({
  src,
  className,
  decorative = false,
}: {
  src: string | null;
  className?: string;
  decorative?: boolean;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={decorative ? "" : "CityPinned"}
        aria-hidden={decorative ? true : undefined}
        className={`${className ?? ""} object-contain`}
        draggable={false}
      />
    );
  }
  return (
    <span
      className={`inline-flex flex-col items-center leading-none ${className ?? ""}`}
      data-cp-placeholder="wordmark"
      title="CityPinned wordmark — placeholder, supply public/brand/wordmark.svg"
    >
      <span className="cp-wordmark cp-chrome-text whitespace-nowrap text-[inherit]">
        CityPinned
      </span>
      <svg viewBox="0 0 200 8" aria-hidden="true" className="h-[0.12em] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cp-wordmark-rule" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="20%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#d7dce1" />
            <stop offset="80%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M2 5 Q100 -1 198 5" stroke="url(#cp-wordmark-rule)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * Placeholder pin: a plain faceted silhouette holding the Ultimate Pin's
 * footprint until the real artwork is supplied. Intentionally simple —
 * this is a spacer, not a logo.
 */
function PinPlaceholder({
  className,
  style,
  decorative,
}: {
  className?: string;
  style?: CSSProperties;
  decorative?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const gradient = `cp-pinph-${uid}`;

  return (
    <svg
      viewBox="0 0 120 200"
      className={className}
      style={style}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "CityPinned Ultimate Pin (placeholder artwork)"}
      aria-hidden={decorative ? true : undefined}
      data-cp-placeholder="ultimate-pin"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>
        CityPinned Ultimate Pin — placeholder, supply public/brand/ultimate-pin.svg
      </title>
      <defs>
        <linearGradient id={`${gradient}-body`} x1="20" y1="8" x2="100" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b3f45" />
          <stop offset="45%" stopColor="#15161a" />
          <stop offset="100%" stopColor="#07080a" />
        </linearGradient>
        <linearGradient id={`${gradient}-rim`} x1="18" y1="6" x2="102" y2="196" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor="#878e96" />
          <stop offset="58%" stopColor="#f3f6f8" />
          <stop offset="100%" stopColor="#7f868e" />
        </linearGradient>
      </defs>

      <path d="M60 6 L104 48 L98 102 L60 194 L22 102 L16 48 Z" fill={`url(#${gradient}-body)`} />
      <path
        d="M60 6 L104 48 L98 102 L60 194 L22 102 L16 48 Z"
        stroke={`url(#${gradient}-rim)`}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M16 48 H104 M60 6 V194" stroke={`url(#${gradient}-rim)`} strokeWidth="0.9" opacity="0.45" />
      <circle cx="60" cy="70" r="24" fill="#0a0b0d" stroke={`url(#${gradient}-rim)`} strokeWidth="2" />
      <text
        x="60"
        y="70"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="22"
        fill="#e9edf1"
      >
        CP
      </text>
    </svg>
  );
}
