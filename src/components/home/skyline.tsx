/**
 * Monochrome night-city backdrop for the hero and the vendor CTA — a
 * deterministic (seeded) SVG skyline with lit windows and a water
 * reflection, so it renders identically on the server and in the browser
 * and needs no photographic asset.
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
  shade: number;
  windows: { x: number; y: number; o: number }[];
}

function buildSkyline(seed: number, count: number): Building[] {
  const rand = seeded(seed);
  const buildings: Building[] = [];
  let x = -6;
  for (let i = 0; i < count; i += 1) {
    const w = 14 + Math.round(rand() * 26);
    const h = 40 + Math.round(rand() * 130);
    const shade = 0.06 + rand() * 0.16;
    const windows: { x: number; y: number; o: number }[] = [];
    for (let wy = 8; wy < h - 6; wy += 9) {
      for (let wx = 4; wx < w - 5; wx += 8) {
        if (rand() > 0.45) {
          windows.push({ x: wx, y: wy, o: 0.18 + rand() * 0.75 });
        }
      }
    }
    buildings.push({ x, w, h, shade, windows });
    x += w + 2 + Math.round(rand() * 5);
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
  const buildings = buildSkyline(seed, 26);
  const groundY = 200;

  return (
    <svg
      viewBox="0 0 520 300"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={`cp-sky-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0b0d" />
          <stop offset="60%" stopColor="#121317" />
          <stop offset="100%" stopColor="#050506" />
        </linearGradient>
        <radialGradient id={`cp-halo-${seed}`} cx="0.5" cy="0.72" r="0.6">
          <stop offset="0%" stopColor="#c9ced4" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cp-water-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1c20" />
          <stop offset="100%" stopColor="#050506" />
        </linearGradient>
        <linearGradient id={`cp-fade-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="520" height="300" fill={`url(#cp-sky-${seed})`} />
      <rect width="520" height="300" fill={`url(#cp-halo-${seed})`} />

      <g>
        {buildings.map((b, i) => (
          <g key={i}>
            <rect
              x={b.x}
              y={groundY - b.h}
              width={b.w}
              height={b.h}
              fill="#0b0c0e"
              stroke="#ffffff"
              strokeOpacity={b.shade}
              strokeWidth="0.6"
            />
            {b.windows.map((w, j) => (
              <rect
                key={j}
                x={b.x + w.x}
                y={groundY - b.h + w.y}
                width="3"
                height="4"
                fill="#eef1f4"
                opacity={w.o * 0.75}
              />
            ))}
          </g>
        ))}
      </g>

      {reflection && (
        <>
          <rect x="0" y={groundY} width="520" height={300 - groundY} fill={`url(#cp-water-${seed})`} />
          <g opacity="0.35" transform={`translate(0 ${groundY * 2}) scale(1 -1)`}>
            {buildings.map((b, i) => (
              <rect
                key={i}
                x={b.x}
                y={groundY - b.h}
                width={b.w}
                height={b.h}
                fill={`url(#cp-fade-${seed})`}
              />
            ))}
          </g>
          <g stroke="#ffffff" strokeOpacity="0.12" strokeWidth="0.8">
            {Array.from({ length: 10 }).map((_, i) => (
              <line key={i} x1="0" y1={groundY + 6 + i * 9} x2="520" y2={groundY + 6 + i * 9} />
            ))}
          </g>
        </>
      )}
    </svg>
  );
}
