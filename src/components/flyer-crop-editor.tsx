"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Same idea as LogoCropEditor but for an lov_entries flyer photo
 * (farmers markets, festivals, guest listings) instead of a vendor's
 * logo — these have no vendor login to manage their own crop, so this
 * only lives in the admin Flyers page. */
export function FlyerCropEditor({
  flyerId,
  photoUrl,
  initialFocalX,
  initialFocalY,
  onSaved,
  onClose,
}: {
  flyerId: string;
  photoUrl: string;
  initialFocalX: number;
  initialFocalY: number;
  onSaved: (x: number, y: number) => void;
  onClose: () => void;
}) {
  const [focal, setFocal] = useState({ x: initialFocalX, y: initialFocalY });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement | null>(null);

  function pointFromEvent(e: { clientX: number; clientY: number }) {
    const rect = imgRef.current!.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    return { x: Math.round(x), y: Math.round(y) };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("lov_entries")
      .update({ flyer_focal_x: focal.x, flyer_focal_y: focal.y })
      .eq("id", flyerId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onSaved(focal.x, focal.y);
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Position This Flyer Photo</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Click or drag anywhere on the photo to move what shows on the flyer card.
        </p>

        <div
          ref={imgRef}
          className="relative mt-3 aspect-square w-full cursor-crosshair overflow-hidden rounded-lg border border-slate-300 bg-slate-100"
          onMouseDown={(e) => {
            setDragging(true);
            setFocal(pointFromEvent(e));
          }}
          onMouseMove={(e) => {
            if (dragging) setFocal(pointFromEvent(e));
          }}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
          onTouchStart={(e) => setFocal(pointFromEvent(e.touches[0]))}
          onTouchMove={(e) => setFocal(pointFromEvent(e.touches[0]))}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Flyer photo" className="pointer-events-none h-full w-full object-contain" />
          <div
            className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.6)]"
            style={{ left: `${focal.x}%`, top: `${focal.y}%` }}
          />
        </div>

        <p className="mt-3 text-xs font-semibold text-slate-700">Flyer crop preview</p>
        <div className="mt-1 h-16 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Flyer crop preview"
            className="h-full w-full object-cover"
            style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
          />
        </div>

        {error && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Position"}
          </button>
        </div>
      </div>
    </div>
  );
}
