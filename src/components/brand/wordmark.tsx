"use client";

import { UltimatePin } from "@/components/brand/ultimate-pin";

/** The chrome "CityPinned" script wordmark with its swash underline. */
export function CityPinnedWordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col items-center leading-none ${className ?? ""}`}>
      <span className="cp-wordmark cp-chrome-text whitespace-nowrap text-[inherit]">
        CityPinned
      </span>
      <svg
        viewBox="0 0 200 10"
        aria-hidden="true"
        className="mt-[0.12em] h-[0.14em] w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="cp-wordmark-swash" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="18%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#c9ced4" />
            <stop offset="82%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M2 6 Q100 -2 198 6" stroke="url(#cp-wordmark-swash)" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * The CityPinned app logo — the Ultimate Pin seated in a machined
 * matte-black tile, used wherever the app-icon element appears.
 */
export function CityPinnedAppLogo({ className }: { className?: string }) {
  return (
    <span
      className={`cp-glass cp-app-tile inline-flex items-center justify-center ${className ?? ""}`}
      style={{ borderRadius: "26%" }}
      aria-hidden="true"
    >
      <UltimatePin className="h-[76%] w-auto" />
    </span>
  );
}
