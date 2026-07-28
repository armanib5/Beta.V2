"use client";

import type { Booth, ZoneBoundary } from "@/lib/types";

const STATUS_FILL: Record<Booth["status"], string> = {
  open: "#dcfce7",
  reserved: "#fef3c7",
  occupied: "#fee2e2",
};

const STATUS_STROKE: Record<Booth["status"], string> = {
  open: "#22c55e",
  reserved: "#f59e0b",
  occupied: "#ef4444",
};

const BOUNDARY_STYLE: Record<
  ZoneBoundary["boundary_type"],
  { stroke: string; dash: string; icon: string; label: string }
> = {
  fence: { stroke: "#64748b", dash: "3,3", icon: "🚧", label: "Fence" },
  gate: { stroke: "#16a34a", dash: "0", icon: "🚪", label: "Gate" },
  exit: { stroke: "#dc2626", dash: "0", icon: "🏃", label: "Exit" },
  vendor_area: { stroke: "#2563eb", dash: "6,2", icon: "🛍️", label: "Vendor Area" },
};

function pointsToPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function midpoint(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 50, y: 50 };
  const mid = points[Math.floor((points.length - 1) / 2)];
  return mid;
}

interface ZoneMapProps {
  booths: Booth[];
  boundaries: ZoneBoundary[];
  mode: "admin" | "vendor";
  /** Current signed-in vendor's own id, so vendor mode can tell "mine" apart from "someone else's". */
  currentVendorId?: string;
  onBoothClick?: (booth: Booth) => void;
  boothLabel?: (booth: Booth) => string;
}

/** Interactive SVG venue map: a percentage-coordinate (0-100) grid of
 * booths with zone boundary overlays (fences/gates/exits/vendor areas).
 * Admins tap any booth to cycle its status; vendors tap an open booth to
 * claim it, or their own booth to release it. */
export function ZoneMap({ booths, boundaries, mode, currentVendorId, onBoothClick, boothLabel }: ZoneMapProps) {
  const laidOut = layoutBooths(booths);

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
      <svg viewBox="0 0 100 100" className="aspect-square w-full min-w-[420px]" role="img" aria-label="Venue zone map">
        <rect x="0" y="0" width="100" height="100" fill="#f8fafc" />

        {boundaries.map((b) => {
          const style = BOUNDARY_STYLE[b.boundary_type];
          const pos = midpoint(b.points);
          const closed = b.boundary_type === "vendor_area" && b.points.length > 2;
          return (
            <g key={b.id}>
              {closed ? (
                <polygon
                  points={b.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={style.stroke}
                  fillOpacity={0.08}
                  stroke={style.stroke}
                  strokeDasharray={style.dash}
                  strokeWidth={0.6}
                />
              ) : (
                <path
                  d={pointsToPath(b.points)}
                  fill="none"
                  stroke={style.stroke}
                  strokeDasharray={style.dash}
                  strokeWidth={0.8}
                  strokeLinecap="round"
                />
              )}
              {b.points.length > 0 && (
                <text x={pos.x} y={pos.y - 1.5} fontSize="3.2" textAnchor="middle" fill={style.stroke}>
                  {style.icon} {b.label ?? style.label}
                </text>
              )}
            </g>
          );
        })}

        {laidOut.map(({ booth, x, y }) => {
          const mine = mode === "vendor" && currentVendorId && booth.vendor_id === currentVendorId;
          const clickable =
            mode === "admin" || (mode === "vendor" && (booth.status === "open" || mine));
          return (
            <g
              key={booth.id}
              transform={`translate(${x}, ${y})`}
              style={{ cursor: clickable ? "pointer" : "default" }}
              onClick={clickable ? () => onBoothClick?.(booth) : undefined}
            >
              <rect
                x={-4}
                y={-4}
                width={8}
                height={8}
                rx={1.4}
                fill={STATUS_FILL[booth.status]}
                stroke={mine ? "#0ea5e9" : STATUS_STROKE[booth.status]}
                strokeWidth={booth.tier === "top" || mine ? 1 : 0.5}
              />
              {booth.tier === "top" && (
                <circle cx={-3.2} cy={-3.2} r={0.9} fill="#f59e0b" />
              )}
              <text x={0} y={0.8} fontSize="2.6" textAnchor="middle" fontWeight={700} fill="#1e293b">
                {boothLabel ? boothLabel(booth) : (booth.booth_number ?? booth.label)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] font-medium text-slate-600">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border-2" style={{ borderColor: STATUS_STROKE.open, background: STATUS_FILL.open }} />
          Open
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border-2" style={{ borderColor: STATUS_STROKE.reserved, background: STATUS_FILL.reserved }} />
          Reserved
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border-2" style={{ borderColor: STATUS_STROKE.occupied, background: STATUS_FILL.occupied }} />
          Occupied
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Top Booth
        </span>
        {Object.entries(BOUNDARY_STYLE).map(([key, s]) => (
          <span key={key} className="flex items-center gap-1">
            {s.icon} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Booths with saved x/y use them as-is; any without (e.g. just created)
 * fall back to an even auto-grid so they're still visible on the map. */
function layoutBooths(booths: Booth[]): { booth: Booth; x: number; y: number }[] {
  const placed = booths.filter((b) => b.x != null && b.y != null);
  const unplaced = booths.filter((b) => b.x == null || b.y == null);
  const cols = Math.max(1, Math.ceil(Math.sqrt(unplaced.length || 1)));
  const cellW = 80 / cols;
  const rows = Math.max(1, Math.ceil(unplaced.length / cols));
  const cellH = 80 / rows;

  return [
    ...placed.map((booth) => ({ booth, x: Number(booth.x), y: Number(booth.y) })),
    ...unplaced.map((booth, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return { booth, x: 10 + cellW * col + cellW / 2, y: 10 + cellH * row + cellH / 2 };
    }),
  ];
}
