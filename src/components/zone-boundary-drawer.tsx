"use client";

import { useRef, useState } from "react";
import type { Booth, ZoneBoundary, ZoneBoundaryPoint } from "@/lib/types";

/** Click-to-place polygon drawer for a zone boundary — tap corners on the
 * map in order (like tracing a pentagon/L-shape around the real event
 * footprint) instead of typing raw "x,y; x,y; ..." coordinate pairs.
 * Existing booths/boundaries render dimmed underneath for reference. */
export function ZoneBoundaryDrawer({
  booths,
  existingBoundaries,
  points,
  onChange,
}: {
  booths: Booth[];
  existingBoundaries: ZoneBoundary[];
  points: ZoneBoundaryPoint[];
  onChange: (points: ZoneBoundaryPoint[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<ZoneBoundaryPoint | null>(null);

  function clickToPoint(e: React.MouseEvent<SVGSVGElement>): ZoneBoundaryPoint {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = Math.round((((e.clientX - rect.left) / rect.width) * 100) * 10) / 10;
    const y = Math.round((((e.clientY - rect.top) / rect.height) * 100) * 10) / 10;
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
  }

  return (
    <div>
      <div className="w-full overflow-x-auto rounded-2xl border-2 border-dashed border-indigo-300 bg-slate-50 p-2">
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          className="aspect-square w-full min-w-[320px] cursor-crosshair"
          role="img"
          aria-label="Click to place boundary corners"
          onClick={(e) => onChange([...points, clickToPoint(e)])}
          onMouseMove={(e) => setHover(clickToPoint(e))}
          onMouseLeave={() => setHover(null)}
        >
          <rect x="0" y="0" width="100" height="100" fill="#f8fafc" />

          {existingBoundaries.map((b) => (
            <polygon
              key={b.id}
              points={b.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="#94a3b8"
              fillOpacity={0.06}
              stroke="#94a3b8"
              strokeWidth={0.4}
              strokeDasharray="2,2"
            />
          ))}
          {booths.map((b) => (
            <circle key={b.id} cx={Number(b.x ?? 50)} cy={Number(b.y ?? 50)} r={1.2} fill="#cbd5e1" />
          ))}

          {points.length > 1 && (
            <polygon
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="#4f46e5"
              fillOpacity={0.12}
              stroke="#4f46e5"
              strokeWidth={0.7}
            />
          )}
          {hover && points.length > 0 && (
            <line
              x1={points[points.length - 1].x}
              y1={points[points.length - 1].y}
              x2={hover.x}
              y2={hover.y}
              stroke="#4f46e5"
              strokeWidth={0.4}
              strokeDasharray="1,1"
            />
          )}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={1.8} fill="#4f46e5" stroke="#fff" strokeWidth={0.4} />
              <text x={p.x} y={p.y - 2.5} fontSize="3" textAnchor="middle" fontWeight={700} fill="#4f46e5">
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-xs text-slate-500">
          {points.length === 0
            ? "Tap each corner of the zone in order — 3+ corners for a closed shape (pentagon, L-shape, whatever the real footprint is)."
            : `${points.length} corner${points.length === 1 ? "" : "s"} placed.`}
        </p>
        {points.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(points.slice(0, -1))}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ↶ Undo Last Corner
          </button>
        )}
        {points.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
