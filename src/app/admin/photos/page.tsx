"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import type { LovEntry, Vendor, VendorPhoto } from "@/lib/types";
import { LogoCropEditor } from "@/components/logo-crop-editor";
import { FlyerCropEditor } from "@/components/flyer-crop-editor";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export default function AdminPhotosPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [photos, setPhotos] = useState<VendorPhoto[]>([]);
  const [flyers, setFlyers] = useState<LovEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [croppingLogo, setCroppingLogo] = useState<Vendor | null>(null);
  const [croppingFlyer, setCroppingFlyer] = useState<LovEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const [{ data: vendorRows }, { data: photoRows }, { data: flyerRows }] = await Promise.all([
        supabase.from("vendors").select("*").order("business_name").returns<Vendor[]>(),
        supabase.from("vendor_photos").select("*").order("sort_order").returns<VendorPhoto[]>(),
        supabase.from("lov_entries").select("*").order("name").returns<LovEntry[]>(),
      ]);
      if (cancelled) return;
      setVendors(vendorRows ?? []);
      setPhotos(photoRows ?? []);
      setFlyers(flyerRows ?? []);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const photosByVendor = useMemo(() => {
    const map = new Map<string, VendorPhoto[]>();
    for (const p of photos) map.set(p.vendor_id, [...(map.get(p.vendor_id) ?? []), p]);
    return map;
  }, [photos]);

  const q = search.trim().toLowerCase();
  const filteredVendors = q ? vendors.filter((v) => v.business_name.toLowerCase().includes(q)) : vendors;
  const filteredFlyers = q ? flyers.filter((f) => f.name.toLowerCase().includes(q)) : flyers;

  async function uploadVendorLogo(vendor: Vendor, file: File) {
    setError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Images must be under 8MB.");
      return;
    }
    setBusyKey(`logo-${vendor.id}`);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      // eslint-disable-next-line react-hooks/purity -- runs only inside this async admin upload handler, never during render
      const path = `${vendor.id}/logo/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("vendor-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("vendor-photos").getPublicUrl(path);
      const { error: updateError } = await supabase.from("vendors").update({ logo_url: publicUrl.publicUrl }).eq("id", vendor.id);
      if (updateError) throw updateError;
      setVendors((prev) => prev.map((v) => (v.id === vendor.id ? { ...v, logo_url: publicUrl.publicUrl } : v)));
      logActivity(supabase, "vendor", vendor.id, vendor.business_name, "Admin set logo photo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload logo.");
    } finally {
      setBusyKey(null);
    }
  }

  async function removeVendorLogo(vendor: Vendor) {
    setError(null);
    setBusyKey(`logo-${vendor.id}`);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("vendors").update({ logo_url: null }).eq("id", vendor.id);
    setBusyKey(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setVendors((prev) => prev.map((v) => (v.id === vendor.id ? { ...v, logo_url: null } : v)));
    logActivity(supabase, "vendor", vendor.id, vendor.business_name, "Admin removed logo photo");
  }

  async function addVendorGalleryPhoto(vendor: Vendor, file: File) {
    setError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Images must be under 8MB.");
      return;
    }
    setBusyKey(`gallery-${vendor.id}`);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${vendor.id}/photos/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("vendor-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("vendor-photos").getPublicUrl(path);
      const existing = photosByVendor.get(vendor.id) ?? [];
      const { data: row, error: insertError } = await supabase
        .from("vendor_photos")
        .insert({ vendor_id: vendor.id, storage_path: path, url: publicUrl.publicUrl, sort_order: existing.length })
        .select("*")
        .single<VendorPhoto>();
      if (insertError || !row) throw insertError ?? new Error("Could not save photo.");
      setPhotos((prev) => [...prev, row]);
      logActivity(supabase, "vendor", vendor.id, vendor.business_name, "Admin added gallery photo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setBusyKey(null);
    }
  }

  async function removeVendorGalleryPhoto(vendor: Vendor, photo: VendorPhoto) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("vendor_photos").delete().eq("id", photo.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await supabase.storage.from("vendor-photos").remove([photo.storage_path]);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    logActivity(supabase, "vendor", vendor.id, vendor.business_name, "Admin took down gallery photo");
  }

  async function uploadFlyerPhoto(flyer: LovEntry, file: File) {
    setError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Images must be under 8MB.");
      return;
    }
    setBusyKey(`flyer-${flyer.id}`);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in.");
      const ext = file.name.split(".").pop() ?? "jpg";
      // eslint-disable-next-line react-hooks/purity -- runs only inside this async admin upload handler, never during render
      const path = `${userData.user.id}/flyers/${flyer.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("vendor-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("vendor-photos").getPublicUrl(path);
      const { error: updateError } = await supabase.from("lov_entries").update({ flyer_image_url: publicUrl.publicUrl }).eq("id", flyer.id);
      if (updateError) throw updateError;
      setFlyers((prev) => prev.map((f) => (f.id === flyer.id ? { ...f, flyer_image_url: publicUrl.publicUrl } : f)));
      logActivity(supabase, "event", flyer.id, flyer.name, "Admin set flyer photo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setBusyKey(null);
    }
  }

  async function removeFlyerPhoto(flyer: LovEntry) {
    setError(null);
    setBusyKey(`flyer-${flyer.id}`);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("lov_entries").update({ flyer_image_url: null }).eq("id", flyer.id);
    setBusyKey(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setFlyers((prev) => prev.map((f) => (f.id === flyer.id ? { ...f, flyer_image_url: null } : f)));
    logActivity(supabase, "event", flyer.id, flyer.name, "Admin took down flyer photo");
  }

  if (status === "loading") {
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }
  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">🔒 Admin access required</h1>
        <Link href="/vendor/login" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">🖼️ Photo Admin</h1>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Every vendor logo, vendor gallery photo, and flyer photo in one place — add, replace, or take one down
        without needing to log in as that account.
      </p>

      <input
        type="search"
        placeholder="Search by vendor or event name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 w-full max-w-sm rounded-full border border-slate-300 px-4 py-2 text-sm"
      />

      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <h2 className="mt-8 text-lg font-bold text-slate-900">Vendors ({filteredVendors.length})</h2>
      <div className="mt-3 space-y-3">
        {filteredVendors.map((vendor) => {
          const gallery = photosByVendor.get(vendor.id) ?? [];
          return (
            <div key={vendor.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">
                  {vendor.business_name}{" "}
                  <span className="text-xs font-normal uppercase text-slate-400">
                    {vendor.status}
                    {vendor.is_internal && " · internal"}
                  </span>
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-600">Logo (flyer photo)</p>
                  <div className="mt-1 flex items-center gap-2">
                    <label className="relative h-16 w-16 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {vendor.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={vendor.logo_url}
                          alt=""
                          className="h-full w-full object-cover"
                          style={{ objectPosition: `${vendor.logo_focal_x}% ${vendor.logo_focal_y}%` }}
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xl text-slate-300">🏪</span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[8px] font-semibold text-white">
                        {busyKey === `logo-${vendor.id}` ? "…" : "Change"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadVendorLogo(vendor, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <div className="flex flex-col gap-1">
                      {vendor.logo_url && (
                        <>
                          <button
                            type="button"
                            onClick={() => setCroppingLogo(vendor)}
                            className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            ✏️ Crop
                          </button>
                          <button
                            type="button"
                            onClick={() => removeVendorLogo(vendor)}
                            className="rounded-full border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                          >
                            Take Down
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-600">Gallery ({gallery.length})</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {gallery.map((photo) => (
                      <div key={photo.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeVendorGalleryPhoto(vendor, photo)}
                          className="absolute inset-x-0 bottom-0 bg-red-600/90 py-0.5 text-center text-[8px] font-semibold text-white opacity-0 group-hover:opacity-100"
                        >
                          Take Down
                        </button>
                      </div>
                    ))}
                    <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-xl text-slate-400 hover:border-slate-400">
                      {busyKey === `gallery-${vendor.id}` ? "…" : "+"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) addVendorGalleryPhoto(vendor, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mt-10 text-lg font-bold text-slate-900">Flyers &amp; Events ({filteredFlyers.length})</h2>
      <div className="mt-3 space-y-2">
        {filteredFlyers.map((flyer) => (
          <div key={flyer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex min-w-0 items-center gap-3">
              <label className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {flyer.flyer_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={flyer.flyer_image_url}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ objectPosition: `${flyer.flyer_focal_x}% ${flyer.flyer_focal_y}%` }}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xl text-slate-300">📌</span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[8px] font-semibold text-white">
                  {busyKey === `flyer-${flyer.id}` ? "…" : "Change"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFlyerPhoto(flyer, file);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{flyer.name}</p>
                <p className="text-xs uppercase text-slate-400">
                  {flyer.type} · {flyer.status}
                </p>
              </div>
            </div>
            {flyer.flyer_image_url && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setCroppingFlyer(flyer)}
                  className="rounded-full border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ✏️ Crop
                </button>
                <button
                  type="button"
                  onClick={() => removeFlyerPhoto(flyer)}
                  className="rounded-full border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Take Down
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {croppingLogo && croppingLogo.logo_url && (
        <LogoCropEditor
          vendorId={croppingLogo.id}
          logoUrl={croppingLogo.logo_url}
          initialFocalX={croppingLogo.logo_focal_x}
          initialFocalY={croppingLogo.logo_focal_y}
          onClose={() => setCroppingLogo(null)}
          onSaved={(x, y) => {
            setVendors((prev) => prev.map((v) => (v.id === croppingLogo.id ? { ...v, logo_focal_x: x, logo_focal_y: y } : v)));
            setCroppingLogo(null);
          }}
        />
      )}
      {croppingFlyer && croppingFlyer.flyer_image_url && (
        <FlyerCropEditor
          flyerId={croppingFlyer.id}
          photoUrl={croppingFlyer.flyer_image_url}
          initialFocalX={croppingFlyer.flyer_focal_x}
          initialFocalY={croppingFlyer.flyer_focal_y}
          onClose={() => setCroppingFlyer(null)}
          onSaved={(x, y) => {
            setFlyers((prev) => prev.map((f) => (f.id === croppingFlyer.id ? { ...f, flyer_focal_x: x, flyer_focal_y: y } : f)));
            setCroppingFlyer(null);
          }}
        />
      )}
    </div>
  );
}
