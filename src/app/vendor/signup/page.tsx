"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, type PricingTier } from "@/lib/types";
import { VendorSignupForm } from "@/components/vendor-signup-form";
import { PLATFORM_FEE_CENTS } from "@/lib/fees";

export default function VendorSignupPage() {
  return (
    <Suspense fallback={null}>
      <VendorSignupContent />
    </Suspense>
  );
}

function VendorSignupContent() {
  const searchParams = useSearchParams();
  const isVenue = searchParams.get("type") === "venue";
  const tierId = searchParams.get("tier") ?? undefined;
  const [tier, setTier] = useState<PricingTier | null>(null);

  useEffect(() => {
    if (!tierId) return;
    const supabase = createClient();
    supabase
      .from("pricing_tiers")
      .select("*")
      .eq("id", tierId)
      .maybeSingle<PricingTier>()
      .then(({ data }) => setTier(data));
  }, [tierId]);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-2xl font-bold text-slate-900">
        {isVenue ? "Create your Venue Hub login" : "Create your vendor login"}
      </h1>
      {!isVenue && (
        <p className="mt-2 text-center text-sm text-slate-600">
          Create your free vendor profile, upload your flyer, showcase your business, join local
          events, and get discovered by customers searching the city.
        </p>
      )}
      <p className="mt-2 text-center text-sm text-slate-600">
        {isVenue
          ? "Your venue gets its own flyer/hub — every show or event you host links straight back to it. Set up your account now; you can switch between Hosting Hub and Show Hub any time from your dashboard."
          : "This account is permanent — it's how you'll manage your CityPinned profile going forward."}
      </p>
      {tierId && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          {tier ? (
            <>
              You&apos;re signing up for <strong>{tier.name}</strong> (
              {formatPrice(tier.price_cents, tier.currency)} + {formatPrice(PLATFORM_FEE_CENTS, tier.currency)}{" "}
              platform processing fee = {formatPrice(tier.price_cents + PLATFORM_FEE_CENTS, tier.currency)}). Create
              your account below, then you&apos;ll go straight to secure Stripe checkout.
            </>
          ) : (
            "Loading your selected plan…"
          )}
        </div>
      )}
      <VendorSignupForm defaultHubType={isVenue ? "hosting" : undefined} tierId={tierId} />
    </div>
  );
}
