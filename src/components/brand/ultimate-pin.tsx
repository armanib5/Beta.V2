"use client";

import { useId, type CSSProperties } from "react";

/**
 * The CityPinned "Ultimate Pin" — a faceted chrome gem cut into a map pin,
 * with the CP monogram medallion at its heart. Drawn as vector so the same
 * mark stays crisp at every size it appears in on the Home Screen (small
 * brand lockup, large hero, closing pin) and needs no raster asset.
 */
export function UltimatePin({
  className,
  glow = false,
  title,
  style,
}: {
  className?: string;
  glow?: boolean;
  title?: string;
  style?: CSSProperties;
}) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `cp-pin-${uid}-${name}`;

  return (
    <svg
      viewBox="0 0 120 210"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={id("crownL")} x1="14" y1="3" x2="60" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#b9c0c8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#4b5158" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={id("crownR")} x1="106" y1="3" x2="60" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e9edf1" stopOpacity="0.7" />
          <stop offset="60%" stopColor="#767c84" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#101215" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id={id("bandL")} x1="14" y1="46" x2="60" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#5e646c" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#08090b" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={id("bandR")} x1="106" y1="46" x2="62" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#cfd5db" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#2a2d31" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#050506" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={id("pointL")} x1="20" y1="100" x2="60" y2="205" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e6eaee" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#43484e" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={id("pointR")} x1="100" y1="100" x2="60" y2="205" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9aa1a9" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#0b0c0e" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id={id("rim")} x1="18" y1="6" x2="102" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#8e959d" />
          <stop offset="55%" stopColor="#f2f5f8" />
          <stop offset="100%" stopColor="#7d848c" />
        </linearGradient>
        <radialGradient id={id("medallion")} cx="0.38" cy="0.3" r="0.85">
          <stop offset="0%" stopColor="#3a3e44" />
          <stop offset="55%" stopColor="#111214" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <linearGradient id={id("mono")} x1="38" y1="46" x2="82" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#d3d8dd" />
          <stop offset="60%" stopColor="#8b9198" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <radialGradient id={id("glow")} cx="0.5" cy="0.42" r="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="60%" stopColor="#8e959d" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {glow && <ellipse cx="60" cy="88" rx="60" ry="86" fill={`url(#${id("glow")})`} />}

      {/* Gem facets */}
      <path d="M60 3 L14 46 L60 46 Z" fill={`url(#${id("crownL")})`} />
      <path d="M60 3 L106 46 L60 46 Z" fill={`url(#${id("crownR")})`} />
      <path d="M14 46 L60 46 L60 104 L19 100 Z" fill={`url(#${id("bandL")})`} />
      <path d="M106 46 L60 46 L60 104 L101 100 Z" fill={`url(#${id("bandR")})`} />
      <path d="M19 100 L60 104 L60 205 Z" fill={`url(#${id("pointL")})`} />
      <path d="M101 100 L60 104 L60 205 Z" fill={`url(#${id("pointR")})`} />

      {/* Facet edges + outer rim */}
      <g stroke={`url(#${id("rim")})`} strokeLinejoin="round">
        <path d="M60 3 L106 46 L101 100 L60 205 L19 100 L14 46 Z" strokeWidth="2.4" />
        <path d="M14 46 H106 M60 3 V205" strokeWidth="1" opacity="0.55" />
        <path d="M19 100 H101" strokeWidth="0.9" opacity="0.4" />
      </g>

      {/* CP medallion */}
      <circle cx="60" cy="70" r="26" fill={`url(#${id("medallion")})`} />
      <circle cx="60" cy="70" r="26" stroke={`url(#${id("rim")})`} strokeWidth="2.2" />
      <circle cx="60" cy="70" r="21" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="0.8" />
      <text
        x="60"
        y="70"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="25"
        fill={`url(#${id("mono")})`}
      >
        CP
      </text>

      {/* Chrome sparkle highlights */}
      <g fill="#ffffff">
        <path d="M60 3 l3.5 9 9 3.5 -9 3.5 -3.5 9 -3.5 -9 -9 -3.5 9 -3.5 Z" opacity="0.9" />
        <path d="M25 118 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" opacity="0.5" />
        <path d="M97 60 l1.8 4.5 4.5 1.8 -4.5 1.8 -1.8 4.5 -1.8 -4.5 -4.5 -1.8 4.5 -1.8 Z" opacity="0.45" />
      </g>
    </svg>
  );
}
