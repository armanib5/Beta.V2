"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VendorPhoto } from "@/lib/types";
import { LogoCropEditor } from "@/components/logo-crop-editor";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function VendorPhotoManager({
  vendorId,
  logoUrl,
  logoFocalX,
  logoFocalY,
  initialPhotos,
}: {
  vendorId: string;
  logoUrl: string | null;
  logoFocalX: number;
  logoFocalY: number;
  initialPhotos: VendorPhoto[];
}) {
  const [logo, setLogo] = useState(logoUrl);
  const [focal, setFocal] = useState({ x: logoFocalX, y: logoFocalY });
  const [croppingLogo, setCroppingLogo] = useState(false);
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  async function uploadFile(file: File, folder: "logo" | "photos") {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error("Images must be under 8MB.");
    }
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${vendorId}/${folder}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("vendor-photos")
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("vendor-photos").getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingLogo(true);
    try {
      const { url } = await uploadFile(file, "logo");
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("vendors")
        .update({ logo_url: url })
        .eq("id", vendorId);
      if (updateError) throw updateError;
      setLogo(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload logo.");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  async function handleRemoveLogo() {
    setError(null);
    setRemovingLogo(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.from("vendors").update({ logo_url: null }).eq("id", vendorId);
      if (updateError) throw updateError;
      setLogo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove logo.");
    } finally {
      setRemovingLogo(false);
    }
  }

  async function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingPhoto(true);
    try {
      const { path, url } = await uploadFile(file, "photos");
      const supabase = createClient();
      const { data: row, error: insertError } = await supabase
        .from("vendor_photos")
        .insert({
          vendor_id: vendorId,
          storage_path: path,
          url,
          sort_order: photos.length,
        })
        .select("*")
        .single<VendorPhoto>();
      if (insertError || !row) throw insertError ?? new Error("Could not save photo.");
      setPhotos((prev) => [...prev, row]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function handlePhotoDelete(photo: VendorPhoto) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("vendor_photos")
      .delete()
      .eq("id", photo.id);
    if (deleteError) {
      setError("Could not remove photo.");
      return;
    }
    await supabase.storage.from("vendor-photos").remove([photo.storage_path]);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-slate-900">Logo</p>
        <p className="mt-1 text-xs text-slate-500">
          This is the photo that shows on your flyer card on the Board — the wide preview below is cropped the
          same way your flyer will be, so what you see here is what shows up there.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt="Vendor logo"
                className="h-full w-full object-cover"
                style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
              />
            ) : (
              <span className="text-2xl">🏪</span>
            )}
          </div>
          <div className="flex h-16 w-full max-w-xs shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
            {logo ? (
              <button
                type="button"
                onClick={() => setCroppingLogo(true)}
                title="Choose what shows on your flyer"
                className="h-full w-full cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo}
                  alt="Flyer crop preview"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
                />
              </button>
            ) : (
              <span className="text-xs text-slate-400">Flyer preview</span>
            )}
          </div>
          {logo && (
            <button
              type="button"
              onClick={() => setCroppingLogo(true)}
              className="text-xs font-semibold text-slate-500 underline hover:text-slate-700"
            >
              ✏️ Adjust crop
            </button>
          )}
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {uploadingLogo ? "Uploading…" : logo ? "Change Logo" : "Upload Logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
                disabled={uploadingLogo}
              />
            </label>
            {logo && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                disabled={removingLogo}
                className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {removingLogo ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">Photos ({photos.length})</p>
        <p className="mt-1 text-xs text-slate-500">
          A gallery for your public profile page — separate from the Logo above. These don&apos;t show on your
          flyer card, only on your full profile.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200">
              <button type="button" onClick={() => setZoomUrl(photo.url)} className="h-full w-full cursor-zoom-in">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption ?? "Vendor photo"} className="h-full w-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => handlePhotoDelete(photo)}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ))}
          <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-2xl text-slate-400 hover:border-slate-400">
            {uploadingPhoto ? "…" : "+"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoAdd}
              disabled={uploadingPhoto}
            />
          </label>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {zoomUrl && (
        <div
          className="fixed inset-0 z-[2000] flex cursor-zoom-out items-center justify-center bg-black/95 p-4"
          onClick={() => setZoomUrl(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomUrl(null);
            }}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white/15 text-lg font-bold text-white hover:bg-white/30"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt="Full size" className="max-h-full max-w-full rounded" />
        </div>
      )}

      {croppingLogo && logo && (
        <LogoCropEditor
          vendorId={vendorId}
          logoUrl={logo}
          initialFocalX={focal.x}
          initialFocalY={focal.y}
          onClose={() => setCroppingLogo(false)}
          onSaved={(x, y) => {
            setFocal({ x, y });
            setCroppingLogo(false);
          }}
        />
      )}
    </div>
  );
}
