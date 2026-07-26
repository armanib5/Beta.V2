import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Vendor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VendorDirectoryPage() {
  const supabase = await createClient();
  const { data: vendors } = await supabase
    .from("vendors")
    .select("*")
    .eq("status", "active")
    .order("is_top10", { ascending: false })
    .order("business_name")
    .returns<Vendor[]>();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Vendor Directory</h1>
      <p className="mt-2 text-sm text-slate-600">
        Every CityPinned vendor in one place. Works on any device, map or no map.
      </p>

      {!vendors?.length ? (
        <p className="mt-10 text-sm text-slate-500">
          No vendors yet — be the first to{" "}
          <Link href="/#pricing" className="font-semibold text-slate-900 underline">
            claim a Founding Vendor spot
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
            <Link
              key={vendor.id}
              href={`/vendor/${vendor.slug}`}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                  {vendor.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vendor.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl">🏪</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{vendor.business_name}</p>
                  {vendor.is_top10 && (
                    <span className="text-xs font-semibold text-amber-600">🏆 Top 10</span>
                  )}
                </div>
              </div>
              {vendor.short_description && (
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                  {vendor.short_description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
