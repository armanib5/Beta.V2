/**
 * Monochrome night-city skyline with a water reflection — a deterministic
 * (seeded) SVG, so server and client render identically and no extra image
 * asset is needed. Used behind the vendor CTA band.
 */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface Building {
  x: number;
  w: number;
  h: number;
  edge: number;
  windows: { x: number; y: number; o: number }[];
}

function buildSkyline(seed: number, count: number): Building[] {
  const rand = seeded(seed);
  const buildings: Building[] = [];
  let x = -8;
  for (let i = 0; i < count; i += 1) {
    const w = 16 + Math.round(rand() * 30);
    const h = 46 + Math.round(rand() * 128);
    const windows: { x: number; y: number; o: number }[] = [];
    for (let wy = 9; wy < h - 8; wy += 10) {
      for (let wx = 5; wx < w - 6; wx += 9) {
        if (rand() > 0.42) windows.push({ x: wx, y: wy, o: 0.2 + rand() * 0.8 });
      }
    }
    buildings.push({ x, w, h, edge: 0.08 + rand() * 0.18, windows });
    x += w + 2 + Math.round(rand() * 6);
  }
  return buildings;
}

export function CitySkyline({
  className,
  seed = 7,
  reflection = true,
}: {
  className?: string;
  seed?: number;
  reflection?: boolean;
}) {
  const buildings = buildSkyline(seed, 28);
  const ground = 205;

  return (
    <svg
      viewBox="0 0 520 300"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={`cp-sky-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#08090b" />
          <stop offset="65%" stopColor="#131519" />
          <stop offset="100%" stopColor="#040405" />
        </linearGradient>
        <radialGradient id={`cp-halo-${seed}`} cx="0.5" cy="0.7" r="0.62">
          <stop offset="0%" stopColor="#d5dae0" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cp-mirror-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="520" height="300" fill={`url(#cp-sky-${seed})`} />
      <rect width="520" height="300" fill={`url(#cp-halo-${seed})`} />

      {buildings.map((b, i) => (
        <g key={i}>
          <rect
            x={b.x}
            y={ground - b.h}
            width={b.w}
            height={b.h}
            fill="#090a0c"
            stroke="#ffffff"
            strokeOpacity={b.edge}
            strokeWidth="0.7"
          />
          {b.windows.map((w, j) => (
            <rect
              key={j}
              x={b.x + w.x}
              y={ground - b.h + w.y}
              width="3"
              height="4.5"
              fill="#f1f4f7"
              opacity={w.o * 0.7}
            />
          ))}
        </g>
      ))}

      {reflection && (
        <>
          <rect x="0" y={ground} width="520" height={300 - ground} fill="#050607" />
          <g opacity="0.4" transform={`translate(0 ${ground * 2}) scale(1 -1)`}>
            {buildings.map((b, i) => (
              <rect
                key={i}
                x={b.x}
                y={ground - b.h}
                width={b.w}
                height={b.h}
                fill={`url(#cp-mirror-${seed})`}
              />
            ))}
          </g>
          <g stroke="#ffffff" strokeOpacity="0.1" strokeWidth="0.9">
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={i} x1="0" y1={ground + 7 + i * 10} x2="520" y2={ground + 7 + i * 10} />
            ))}
          </g>
        </>
      )}
    </svg>
  );
}
