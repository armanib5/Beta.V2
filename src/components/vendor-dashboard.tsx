"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Category, Vendor, VendorPhoto } from "@/lib/types";
import { VendorPhotoManager } from "@/components/vendor-photo-manager";

export function VendorDashboard({
  vendor,
  categories,
  selectedCategoryIds,
  photos,
}: {
  vendor: Vendor;
  categories: Category[];
  selectedCategoryIds: string[];
  photos: VendorPhoto[];
}) {
  const router = useRouter();

  const [form, setForm] = useState({
    business_name: vendor.business_name,
    owner_name: vendor.owner_name ?? "",
    phone: vendor.phone ?? "",
    instagram_handle: vendor.instagram_handle ?? "",
    website_url: vendor.website_url ?? "",
    short_description: vendor.short_description ?? "",
  });
  const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({
    lat: vendor.lat,
    lng: vendor.lng,
  });
  const [locating, setLocating] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(new Set(selectedCategoryIds));
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation isn't supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location — check location permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const supabase = createClient();

      const { error: profileError } = await supabase
        .from("vendors")
        .update({
          business_name: form.business_name,
          owner_name: form.owner_name || null,
          phone: form.phone || null,
          instagram_handle: form.instagram_handle || null,
          website_url: form.website_url || null,
          short_description: form.short_description || null,
          lat: location.lat,
          lng: location.lng,
        })
        .eq("id", vendor.id);
      if (profileError) throw profileError;

      const toAdd = [...selectedCategories].filter((id) => !selectedCategoryIds.includes(id));
      const toRemove = selectedCategoryIds.filter((id) => !selectedCategories.has(id));

      if (toAdd.length) {
        const { error: addError } = await supabase
          .from("vendor_categories")
          .insert(toAdd.map((category_id) => ({ vendor_id: vendor.id, category_id })));
        if (addError) throw addError;
      }
      if (toRemove.length) {
        const { error: removeError } = await supabase
          .from("vendor_categories")
          .delete()
          .eq("vendor_id", vendor.id)
          .in("category_id", toRemove);
        if (removeError) throw removeError;
      }

      setSavedMessage("Saved!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {vendor.status === "pending" && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Pending review.</strong> We&apos;ll activate your account after confirming your
          payment — finish setting up your profile below in the meantime.
        </div>
      )}
      {vendor.status === "suspended" && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Your account is currently suspended. Contact us if you think this is a mistake.
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{vendor.business_name}</h1>
            {vendor.is_founding_vendor && (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                Founding Vendor
              </span>
            )}
            {vendor.is_top10 && (
              <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">
                🏆 Top 10
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Public profile:{" "}
            <Link href={`/vendor?slug=${encodeURIComponent(vendor.slug)}`} className="underline">
              /vendor?slug={vendor.slug}
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Sign Out
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Photos &amp; Logo</h2>
        <div className="mt-4">
          <VendorPhotoManager vendorId={vendor.id} logoUrl={vendor.logo_url} initialPhotos={photos} />
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Profile Details</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <input
              type="text"
              value={form.business_name}
              onChange={(e) => updateField("business_name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </Field>
          <Field label="Owner name">
            <input
              type="text"
              value={form.owner_name}
              onChange={(e) => updateField("owner_name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Instagram handle">
            <input
              type="text"
              placeholder="@yourbusiness"
              value={form.instagram_handle}
              onChange={(e) => updateField("instagram_handle", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <input
              type="url"
              placeholder="https://"
              value={form.website_url}
              onChange={(e) => updateField("website_url", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Short description" className="sm:col-span-2">
            <textarea
              rows={3}
              maxLength={280}
              value={form.short_description}
              onChange={(e) => updateField("short_description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Location</p>
          <p className="mt-1 text-xs text-slate-500">
            Powers &quot;Near You&quot; sorting on the Vendor Directory.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {locating ? "Locating…" : "📍 Use My Current Location"}
            </button>
            {location.lat !== null && location.lng !== null && (
              <span className="text-xs text-slate-500">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Category tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((category) => {
              const active = selectedCategories.has(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {category.icon} {category.name}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {savedMessage && <p className="text-sm font-medium text-green-600">{savedMessage}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 sm:w-auto"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
