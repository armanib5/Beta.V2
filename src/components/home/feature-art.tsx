import { UltimatePin } from "@/components/brand/ultimate-pin";
import { BASE_PATH } from "@/lib/site";

/**
 * The artwork layers behind the three main feature cards. Everything is
 * vector/CSS except the existing cork photo already shipped with the V1
 * board, which is reused here desaturated to fit the black/chrome palette.
 */

/** A packed corkboard: the cork photo, wall-to-wall flyers, pushpins. */
export function CorkboardArt() {
  const flyers = Array.from({ length: 30 }, (_, i) => ({
    tone: 0.14 + ((i * 37) % 7) * 0.045,
    tilt: (((i * 13) % 5) - 2) * 0.55,
    lines: 2 + ((i * 7) % 3),
  }));

  return (
    <div className="cp-art">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BASE_PATH}/board/img/cork-texture.jpg`}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-45 grayscale contrast-125 brightness-[0.45]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/85" />
      <div className="absolute inset-0 grid grid-cols-5 grid-rows-6 gap-[3px] p-[6px]">
        {flyers.map((flyer, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-[2px]"
            style={{
              transform: `rotate(${flyer.tilt}deg)`,
              background: `linear-gradient(165deg, rgba(255,255,255,${flyer.tone + 0.22}), rgba(255,255,255,${flyer.tone}) 45%, rgba(0,0,0,0.65))`,
              boxShadow: "0 2px 4px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <span
              className="absolute left-1/2 top-[2px] h-[3px] w-[3px] -translate-x-1/2 rounded-full"
              style={{ background: "linear-gradient(180deg,#fff,#7b8189)" }}
            />
            <span className="absolute inset-x-[3px] bottom-[3px] flex flex-col gap-[2px]">
              {Array.from({ length: flyer.lines }).map((_, l) => (
                <span
                  key={l}
                  className="block h-[1.5px] rounded-full bg-white/45"
                  style={{ width: `${60 + ((i + l) % 4) * 10}%` }}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
    </div>
  );
}

/** A dark city grid with CityPinned pins dropped across it. */
export function MapArt() {
  const pins = [
    { left: "50%", top: "26%", size: 42, z: 3 },
    { left: "22%", top: "50%", size: 30, z: 2 },
    { left: "76%", top: "48%", size: 32, z: 2 },
    { left: "37%", top: "72%", size: 24, z: 1 },
    { left: "63%", top: "76%", size: 26, z: 1 },
  ];

  return (
    <div className="cp-art">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 30%, #1a1c20 0%, #0a0b0c 55%, #050506 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 26px), repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 26px)",
          transform: "perspective(320px) rotateX(34deg) scale(1.5)",
          transformOrigin: "center 30%",
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 18px)",
        }}
      />
      {pins.map((pin) => (
        <span
          key={`${pin.left}-${pin.top}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: pin.left, top: pin.top, zIndex: pin.z }}
        >
          <UltimatePin className="w-auto" glow style={{ height: pin.size }} />
        </span>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/40" />
    </div>
  );
}

/** A market booth against a brick wall. */
export function BoothArt() {
  return (
    <div className="cp-art">
      {/* Brick wall — staggered courses with mortar shading */}
      <div className="absolute inset-0 bg-[#0a0b0d]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02) 55%, rgba(0,0,0,0.5)), repeating-linear-gradient(0deg, rgba(255,255,255,0.15) 0 1px, transparent 1px 14px)",
        }}
      />
      {/* Odd courses */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.13) 0 1px, transparent 1px 30px)",
          maskImage: "repeating-linear-gradient(180deg, #000 0 14px, transparent 14px 28px)",
          WebkitMaskImage: "repeating-linear-gradient(180deg, #000 0 14px, transparent 14px 28px)",
        }}
      />
      {/* Even courses, offset by half a brick */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.13) 0 1px, transparent 1px 30px)",
          backgroundPosition: "15px 0",
          maskImage: "repeating-linear-gradient(180deg, transparent 0 14px, #000 14px 28px)",
          WebkitMaskImage: "repeating-linear-gradient(180deg, transparent 0 14px, #000 14px 28px)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(75%_55%_at_50%_15%,rgba(255,255,255,0.14),transparent_72%)]" />

      <svg viewBox="0 0 200 148" className="absolute inset-x-0 bottom-0 h-[88%] w-full" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <defs>
          <linearGradient id="cp-booth-chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#9aa1a9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#2c2f33" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="cp-booth-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c1e21" />
            <stop offset="100%" stopColor="#08090a" />
          </linearGradient>
        </defs>

        {/* Awning */}
        <path d="M18 34 H182 L172 58 H28 Z" fill="url(#cp-booth-dark)" stroke="#e8ebee" strokeOpacity="0.45" />
        {Array.from({ length: 9 }).map((_, i) => (
          <path
            key={i}
            d={`M${22 + i * 18} 34 L${30 + i * 18} 58 L${39 + i * 18} 58 L${31 + i * 18} 34 Z`}
            fill="#ffffff"
            opacity={i % 2 === 0 ? 0.16 : 0.05}
          />
        ))}
        <path d="M28 58 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0"
          fill="none" stroke="url(#cp-booth-chrome)" strokeWidth="1.5" />

        {/* Posts + counter */}
        <rect x="24" y="58" width="5" height="78" fill="url(#cp-booth-chrome)" />
        <rect x="171" y="58" width="5" height="78" fill="url(#cp-booth-chrome)" />
        <rect x="34" y="96" width="132" height="6" fill="url(#cp-booth-chrome)" opacity="0.75" />
        <rect x="30" y="112" width="140" height="26" fill="url(#cp-booth-dark)" stroke="#e8ebee" strokeOpacity="0.4" />
        <rect x="30" y="108" width="140" height="6" fill="url(#cp-booth-chrome)" />

        {/* Bottles / jars on the shelf */}
        {Array.from({ length: 8 }).map((_, i) => (
          <g key={i} opacity={0.85}>
            <rect x={44 + i * 15} y={80} width="8" height="16" rx="2" fill="#0e0f11" stroke="#dfe3e7" strokeOpacity="0.5" />
            <rect x={46.5 + i * 15} y={75} width="3" height="6" fill="#c9ced4" opacity="0.8" />
          </g>
        ))}

        {/* Planters */}
        <g stroke="#dfe3e7" strokeOpacity="0.5" fill="url(#cp-booth-dark)">
          <path d="M8 126 h16 l-2 12 H10 Z" />
          <path d="M176 126 h16 l-2 12 h-12 Z" />
        </g>
        <g stroke="#e8ebee" strokeOpacity="0.45" fill="none">
          <path d="M12 126 q2-10 4-13 M20 126 q-2-9 -3-12 M180 126 q2-10 4-13 M188 126 q-2-9 -3-12" />
        </g>

        {/* String lights */}
        <path d="M12 26 q88 22 176 0" fill="none" stroke="#ffffff" strokeOpacity="0.28" />
        {Array.from({ length: 7 }).map((_, i) => (
          <circle key={i} cx={26 + i * 25} cy={30 + Math.sin(i) * 2 + 4} r="2.2" fill="#ffffff" opacity="0.7" />
        ))}
      </svg>

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
    </div>
  );
}
