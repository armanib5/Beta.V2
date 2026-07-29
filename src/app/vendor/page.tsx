"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, MenuItem, Vendor, VendorPhoto } from "@/lib/types";
import { MenuHub } from "@/components/menu-hub";

export default function VendorProfilePage() {
  return (
    <Suspense fallback={null}>
      <VendorProfile />
    </Suspense>
  );
}

function VendorProfile() {
  const slug = useSearchParams().get("slug");
  const [status, setStatus] = useState<"loading" | "not-found" | "ready">(slug ? "loading" : "not-found");
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [photos, setPhotos] = useState<VendorPhoto[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("vendors")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle<Vendor>()
      .then(async ({ data: vendorRow }) => {
        if (cancelled) return;
        if (!vendorRow) {
          setStatus("not-found");
          return;
        }
        setVendor(vendorRow);

        const [{ data: categoryLinks }, { data: photoRows }, { data: menuRows }] = await Promise.all([
          supabase.from("vendor_categories").select("categories(*)").eq("vendor_id", vendorRow.id),
          supabase
            .from("vendor_photos")
            .select("*")
            .eq("vendor_id", vendorRow.id)
            .order("sort_order")
            .returns<VendorPhoto[]>(),
          supabase
            .from("menu_items")
            .select("*")
            .eq("vendor_id", vendorRow.id)
            .eq("status", "active")
            .order("sort_order")
            .returns<MenuItem[]>(),
        ]);
        if (cancelled) return;
        setCategories(
          (categoryLinks ?? []).map((row) => row.categories as unknown as Category).filter(Boolean),
        );
        setPhotos(photoRows ?? []);
        setMenuItems(menuRows ?? []);
        setStatus("ready");
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (status === "loading") {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500">Loading…</div>;
  }

  if (status === "not-found" || !vendor) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Vendor not found</h1>
        <Link href="/vendors" className="mt-4 inline-block text-sm font-semibold text-slate-900 underline">
          Back to the Vendor Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
          {vendor.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vendor.logo_url} alt={vendor.business_name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl">🏪</span>
          )}
        </div>
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
          <div className="mt-1 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category.id}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                {category.icon} {category.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {vendor.short_description && (
        <p className="mt-6 text-slate-700">{vendor.short_description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {vendor.instagram_handle && (
          <a
            href={`https://instagram.com/${vendor.instagram_handle.replace(/^@/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 underline"
          >
            📷 {vendor.instagram_handle}
          </a>
        )}
        {vendor.website_url && (
          <a
            href={vendor.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 underline"
          >
            🌐 Website
          </a>
        )}
      </div>

      {(vendor.entity_type === "restaurant" || vendor.entity_type === "bar") && vendor.menu_hub_enabled && (
        <MenuHub items={menuItems} happyHourSpecials={vendor.happy_hour_specials} />
      )}

      {photos.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.caption ?? vendor.business_name}
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}
