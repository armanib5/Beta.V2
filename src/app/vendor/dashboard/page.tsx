"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, Vendor, VendorPhoto } from "@/lib/types";
import { VendorDashboard } from "@/components/vendor-dashboard";

export default function VendorDashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<{
    vendor: Vendor;
    categories: Category[];
    selectedCategoryIds: string[];
    photos: VendorPhoto[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return;
      if (!user) {
        router.replace("/vendor/login");
        return;
      }

      const [{ data: vendor }, { data: categories }, { data: vendorCategories }, { data: photos }] =
        await Promise.all([
          supabase.from("vendors").select("*").eq("id", user.id).maybeSingle<Vendor>(),
          supabase.from("categories").select("*").order("sort_order").returns<Category[]>(),
          supabase.from("vendor_categories").select("category_id").eq("vendor_id", user.id),
          supabase
            .from("vendor_photos")
            .select("*")
            .eq("vendor_id", user.id)
            .order("sort_order")
            .returns<VendorPhoto[]>(),
        ]);

      if (cancelled) return;

      if (!vendor) {
        router.replace("/vendor/signup");
        return;
      }

      setState({
        vendor,
        categories: categories ?? [],
        selectedCategoryIds: (vendorCategories ?? []).map((row) => row.category_id),
        photos: photos ?? [],
      });
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!state) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500">Loading…</div>;
  }

  return (
    <VendorDashboard
      vendor={state.vendor}
      categories={state.categories}
      selectedCategoryIds={state.selectedCategoryIds}
      photos={state.photos}
    />
  );
}
