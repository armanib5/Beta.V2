"use client";

import { Pin } from "@/components/brand/brand-context";
import { BASE_PATH } from "@/lib/site";

/**
 * Artwork layers for the three feature cards. Everything here is real
 * CSS/SVG over the photography already shipped with the V1 board — no new
 * image assets, and nothing that would break if a photo is swapped later.
 */

const CORK = `${BASE_PATH}/board/img/cork-texture.jpg`;
const FLYER = `${BASE_PATH}/board/img/mariachi-festival-flyer.jpg`;

/** A wall-to-wall corkboard: cork surface, packed flyers, pushpins. */
export function CorkboardArt() {
  // Each tile crops a different region of the flyer photo, so the board
  // reads as many different flyers rather than one image repeated.
  const flyers = Array.from({ length: 24 }, (_, i) => ({
    posX: (i * 37) % 100,
    posY: (i * 61) % 100,
    size: 190 + ((i * 23) % 90),
    tilt: (((i * 17) % 5) - 2) * 0.7,
    bright: 0.62 + ((i * 13) % 5) * 0.12,
  }));

  return (
    <div className="cp-art">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={CORK}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-70 grayscale"
        style={{ filter: "grayscale(1) brightness(0.5) contrast(1.2)" }}
      />
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-6 gap-[3px] p-[5px]">
        {flyers.map((flyer, i) => (
          <span
            key={i}
            className="relative block overflow-hidden rounded-[2px]"
            style={{
              transform: `rotate(${flyer.tilt}deg)`,
              backgroundImage: `url(${FLYER})`,
              backgroundSize: `${flyer.size}%`,
              backgroundPosition: `${flyer.posX}% ${flyer.posY}%`,
              filter: `grayscale(1) brightness(${flyer.bright}) contrast(1.3)`,
              boxShadow:
                "0 2px 5px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 0 0 1px rgba(255,255,255,0.12)",
            }}
          >
            <span
              className="absolute left-1/2 top-[2px] h-[4px] w-[4px] -translate-x-1/2 rounded-full"
              style={{
                background: "radial-gradient(circle at 30% 30%, #ffffff, #6b7178 70%, #23262a)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.9)",
              }}
            />
          </span>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/45" />
    </div>
  );
}

/** A dark street grid with Ultimate Pin markers dropped across it. */
export function MapArt() {
  const pins = [
    { left: "50%", top: "27%", size: 46, z: 3 },
    { left: "21%", top: "49%", size: 32, z: 2 },
    { left: "78%", top: "46%", size: 34, z: 2 },
    { left: "36%", top: "73%", size: 25, z: 1 },
    { left: "64%", top: "77%", size: 27, z: 1 },
  ];

  return (
    <div className="cp-art">
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(120% 95% at 50% 26%, #1d2024 0%, #0a0b0d 58%, #040405 100%)",
        }}
      />
      {/* Street grid, laid back in perspective */}
      <div
        className="absolute inset-0 opacity-55"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 28px)",
          transform: "perspective(340px) rotateX(36deg) scale(1.55)",
          transformOrigin: "center 28%",
        }}
      />
      {/* A couple of brighter avenues */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent 32%, rgba(255,255,255,0.16) 33%, transparent 34%), linear-gradient(0deg, transparent 61%, rgba(255,255,255,0.13) 62%, transparent 63%)",
        }}
      />
      {pins.map((pin) => (
        <span
          key={`${pin.left}-${pin.top}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_6px_10px_rgba(0,0,0,0.9)]"
          style={{ left: pin.left, top: pin.top, zIndex: pin.z }}
        >
          <Pin className="w-auto" style={{ height: pin.size }} decorative />
        </span>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/35" />
    </div>
  );
}

/** A market booth against a brick wall. */
export function BoothArt() {
  return (
    <div className="cp-art">
      {/* Brick wall — staggered courses */}
      <div className="absolute inset-0 bg-[#0a0b0d]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02) 58%, rgba(0,0,0,0.55)), repeating-linear-gradient(0deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 14px)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 30px)",
          maskImage: "repeating-linear-gradient(180deg, #000 0 14px, transparent 14px 28px)",
          WebkitMaskImage: "repeating-linear-gradient(180deg, #000 0 14px, transparent 14px 28px)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 30px)",
          backgroundPosition: "15px 0",
          maskImage: "repeating-linear-gradient(180deg, transparent 0 14px, #000 14px 28px)",
          WebkitMaskImage: "repeating-linear-gradient(180deg, transparent 0 14px, #000 14px 28px)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(78%_58%_at_50%_12%,rgba(255,255,255,0.16),transparent_74%)]" />

      <svg
        viewBox="0 0 200 148"
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-x-0 bottom-0 h-[90%] w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="cp-booth-chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#a2a9b1" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#2b2e33" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="cp-booth-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e2125" />
            <stop offset="100%" stopColor="#07080a" />
          </linearGradient>
        </defs>

        {/* String lights */}
        <path d="M10 22 q90 24 180 0" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.8" />
        {Array.from({ length: 8 }).map((_, i) => {
          const x = 20 + i * 23;
          const y = 27 + Math.sin((i / 7) * Math.PI) * 5.5;
          return (
            <g key={i}>
              <line x1={x} y1={y - 3} x2={x} y2={y} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.6" />
              <circle cx={x} cy={y + 1.6} r="2.4" fill="#ffffff" opacity="0.75" />
              <circle cx={x} cy={y + 1.6} r="4.6" fill="#ffffff" opacity="0.1" />
            </g>
          );
        })}

        {/* Awning */}
        <path d="M16 40 H184 L173 62 H27 Z" fill="url(#cp-booth-body)" stroke="#e9edf1" strokeOpacity="0.5" strokeWidth="0.9" />
        {Array.from({ length: 10 }).map((_, i) => (
          <path
            key={i}
            d={`M${20 + i * 17} 40 L${28 + i * 17} 62 L${36 + i * 17} 62 L${28.5 + i * 17} 40 Z`}
            fill="#ffffff"
            opacity={i % 2 === 0 ? 0.17 : 0.05}
          />
        ))}
        <path
          d="M27 62 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0"
          fill="none"
          stroke="url(#cp-booth-chrome)"
          strokeWidth="1.4"
        />

        {/* Frame + counter */}
        <rect x="23" y="62" width="5" height="76" fill="url(#cp-booth-chrome)" />
        <rect x="172" y="62" width="5" height="76" fill="url(#cp-booth-chrome)" />
        <rect x="33" y="96" width="134" height="5" fill="url(#cp-booth-chrome)" opacity="0.8" />
        <rect x="28" y="110" width="144" height="5" fill="url(#cp-booth-chrome)" />
        <rect x="28" y="114" width="144" height="26" fill="url(#cp-booth-body)" stroke="#e9edf1" strokeOpacity="0.42" strokeWidth="0.8" />
        <path d="M28 127 H172" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="0.7" />

        {/* Goods on the shelf */}
        {Array.from({ length: 9 }).map((_, i) => (
          <g key={i} opacity="0.9">
            <rect x={40 + i * 14} y={80} width="8" height="16" rx="2.5" fill="#0d0e10" stroke="#e2e6ea" strokeOpacity="0.55" strokeWidth="0.7" />
            <rect x={42.5 + i * 14} y={75} width="3" height="6" fill="#cfd5db" opacity="0.85" />
            <rect x={41 + i * 14} y={86} width="6" height="4" fill="#ffffff" opacity="0.14" />
          </g>
        ))}

        {/* Planters */}
        <g stroke="#e2e6ea" strokeOpacity="0.5" strokeWidth="0.8" fill="url(#cp-booth-body)">
          <path d="M6 126 h16 l-2.5 13 H8.5 Z" />
          <path d="M178 126 h16 l-2.5 13 h-11 Z" />
        </g>
        <g stroke="#eef1f4" strokeOpacity="0.45" strokeWidth="0.8" fill="none">
          <path d="M10 126 q1.5-11 4-14 M18 126 q-2-10 -3.5-13 M182 126 q1.5-11 4-14 M190 126 q-2-10 -3.5-13" />
        </g>
      </svg>

      <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-transparent to-transparent" />
    </div>
  );
}
