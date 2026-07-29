"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slug";
import type { Category, LovEntry, MenuItem, PricingTier, Vendor, VendorPhoto } from "@/lib/types";
import { VendorDashboard } from "@/components/vendor-dashboard";

const SLUG_RETRY_ATTEMPTS = 5;

export default function VendorDashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<{
    vendor: Vendor;
    categories: Category[];
    selectedCategoryIds: string[];
    photos: VendorPhoto[];
    tiers: PricingTier[];
    myListings: LovEntry[];
    menuItems: MenuItem[];
  } | null>(null);
  // A signed-up-but-no-vendor-row account (email-confirmation delayed the
  // signup form's insert, so it never ran) has no profile to redirect to
  // /vendor/signup for either — that page calls auth.signUp() again, which
  // just fails with "already registered" since the account already exists.
  // This finishes the same insert using the session that already exists.
  const [needsProfile, setNeedsProfile] = useState<{ userId: string; email: string } | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return;
      if (!user) {
        router.replace("/vendor/login");
        return;
      }

      const [
        { data: vendor },
        { data: categories },
        { data: vendorCategories },
        { data: photos },
        { data: tiers },
        { data: myListings },
        { data: menuItems },
      ] = await Promise.all([
        supabase.from("vendors").select("*").eq("id", user.id).maybeSingle<Vendor>(),
        supabase.from("categories").select("*").order("sort_order").returns<Category[]>(),
        supabase.from("vendor_categories").select("category_id").eq("vendor_id", user.id),
        supabase
          .from("vendor_photos")
          .select("*")
          .eq("vendor_id", user.id)
          .order("sort_order")
          .returns<VendorPhoto[]>(),
        supabase.from("pricing_tiers").select("*").eq("is_active", true).order("sort_order").returns<PricingTier[]>(),
        supabase.from("lov_entries").select("*").eq("vendor_id", user.id).returns<LovEntry[]>(),
        supabase.from("menu_items").select("*").eq("vendor_id", user.id).order("sort_order").returns<MenuItem[]>(),
      ]);

      if (cancelled) return;

      if (!vendor) {
        setNeedsProfile({ userId: user.id, email: user.email ?? "" });
        return;
      }

      setState({
        vendor,
        categories: categories ?? [],
        selectedCategoryIds: (vendorCategories ?? []).map((row) => row.category_id),
        photos: photos ?? [],
        tiers: tiers ?? [],
        myListings: myListings ?? [],
        menuItems: menuItems ?? [],
      });
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function finishProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!needsProfile || !businessName.trim()) return;
    setProfileError(null);
    setCreatingProfile(true);
    try {
      const supabase = createClient();
      const baseSlug = slugify(businessName);
      let lastError: string | null = null;

      for (let attempt = 0; attempt < SLUG_RETRY_ATTEMPTS; attempt++) {
        const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        const { error: insertError } = await supabase.from("vendors").insert({
          id: needsProfile.userId,
          slug,
          business_name: businessName,
          contact_email: needsProfile.email,
          status: "pending",
        });

        if (!insertError) {
          router.refresh();
          window.location.reload();
          return;
        }
        if (insertError.code === "23505") {
          lastError = insertError.message; // slug collision — retry with a suffix
          continue;
        }
        setProfileError(insertError.message);
        return;
      }
      setProfileError(lastError ?? "Could not create your vendor profile. Please try again.");
    } finally {
      setCreatingProfile(false);
    }
  }

  if (needsProfile) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-center text-2xl font-bold text-slate-900">Finish setting up your profile</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Your account is confirmed — just need a business name to finish creating your profile.
        </p>
        <form onSubmit={finishProfile} className="mt-6 space-y-3">
          <input
            type="text"
            required
            placeholder="Business name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          {profileError && <p className="text-sm font-medium text-red-600">{profileError}</p>}
          <button
            type="submit"
            disabled={creatingProfile}
            className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {creatingProfile ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  if (!state) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500">Loading…</div>;
  }

  return (
    <VendorDashboard
      vendor={state.vendor}
      categories={state.categories}
      selectedCategoryIds={state.selectedCategoryIds}
      photos={state.photos}
      tiers={state.tiers}
      myListings={state.myListings}
      menuItems={state.menuItems}
    />
  );
}
