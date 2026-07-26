import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category, Vendor, VendorPhoto } from "@/lib/types";
import { VendorDashboard } from "@/components/vendor-dashboard";

export const dynamic = "force-dynamic";

export default async function VendorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/vendor/login");
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

  if (!vendor) {
    redirect("/vendor/signup");
  }

  return (
    <VendorDashboard
      vendor={vendor}
      categories={categories ?? []}
      selectedCategoryIds={(vendorCategories ?? []).map((row) => row.category_id)}
      photos={photos ?? []}
    />
  );
}
