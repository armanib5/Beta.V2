"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LovEntry } from "@/lib/types";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const STATUS_STYLES: Record<LovEntry["status"], string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  draft: "bg-slate-200 text-slate-700",
  archived: "bg-red-100 text-red-800",
  rejected: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<LovEntry["status"], string> = {
  active: "Live",
  pending: "Pending Review",
  draft: "Draft",
  archived: "Archived",
  rejected: "Rejected",
};

export function MyListingManager({ vendorId, initialListings }: { vendorId: string; initialListings: LovEntry[] }) {
  const [listings, setListings] = useState(initialListings);

  if (!listings.length) return null;

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Your Flyer / Listing</h2>
      <p className="mt-1 text-sm text-slate-600">
        Upload the photo that shows on your flyer and edit its description. Changing the name, date, or
        location goes through admin review — message us for those changes.
      </p>
      <div className="mt-4 space-y-4">
        {listings.map((listing) => (
          <ListingRow
            key={listing.id}
            vendorId={vendorId}
            listing={listing}
            onChange={(next) => setListings((prev) => prev.map((l) => (l.id === next.id ? next : l)))}
          />
        ))}
      </div>
    </div>
  );
}

function ListingRow({
  vendorId,
  listing,
  onChange,
}: {
  vendorId: string;
  listing: LovEntry;
  onChange: (next: LovEntry) => void;
}) {
  const [details, setDetails] = useState(listing.details ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("Images must be under 8MB.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${vendorId}/flyer/${listing.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("vendor-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("vendor-photos").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("lov_entries")
        .update({ flyer_image_url: data.publicUrl })
        .eq("id", listing.id);
      if (updateError) throw updateError;
      onChange({ ...listing, flyer_image_url: data.publicUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function saveDetails() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("lov_entries").update({ details }).eq("id", listing.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onChange({ ...listing, details });
    setMessage("Saved!");
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-slate-900">{listing.name}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[listing.status]}`}>
          {STATUS_LABELS[listing.status]}
        </span>
      </div>
      {listing.status === "rejected" && (
        <p className="mt-1 text-xs text-red-600">
          This listing wasn&apos;t approved and isn&apos;t showing on the board. Message us if you&apos;d like to
          resubmit it.
        </p>
      )}
      {listing.status === "pending" && (
        <p className="mt-1 text-xs text-amber-700">Waiting on admin review — it&apos;ll show on the board once approved.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {listing.flyer_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.flyer_image_url} alt={listing.name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-3xl text-slate-300">📌</span>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[10px] font-semibold text-white">
            {uploading ? "Uploading…" : "Change photo"}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploading} />
        </label>
        <div className="min-w-[220px] flex-1">
          <label className="block text-xs font-medium text-slate-700">Description</label>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={saveDetails}
            disabled={saving}
            className="mt-2 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Description"}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      {message && <p className="mt-2 text-xs font-medium text-green-600">{message}</p>}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-xs font-medium text-slate-700">Preview — how this looks on the board</p>
        <div className="mt-1 max-w-xs overflow-hidden rounded-xl border border-slate-200">
          <div className="relative h-28 w-full bg-slate-100">
            {listing.flyer_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.flyer_image_url}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: `${listing.flyer_focal_x}% ${listing.flyer_focal_y}%` }}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-3xl text-slate-300">📌</span>
            )}
          </div>
          <div className="p-3">
            <p className="text-sm font-bold text-slate-900">{listing.name}</p>
            {listing.location && <p className="mt-0.5 text-xs text-slate-500">📍 {listing.location}</p>}
            {details && <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600">{details}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
