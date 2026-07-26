import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category, Vendor, VendorPhoto } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VendorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle<Vendor>();

  if (!vendor) notFound();

  const [{ data: categoryLinks }, { data: photos }] = await Promise.all([
    supabase
      .from("vendor_categories")
      .select("categories(*)")
      .eq("vendor_id", vendor.id),
    supabase
      .from("vendor_photos")
      .select("*")
      .eq("vendor_id", vendor.id)
      .order("sort_order")
      .returns<VendorPhoto[]>(),
  ]);

  const categories = (categoryLinks ?? [])
    .map((row) => row.categories as unknown as Category)
    .filter(Boolean);

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

      {photos && photos.length > 0 && (
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
