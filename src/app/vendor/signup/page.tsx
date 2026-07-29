"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VendorSignupForm } from "@/components/vendor-signup-form";

export default function VendorSignupPage() {
  return (
    <Suspense fallback={null}>
      <VendorSignupContent />
    </Suspense>
  );
}

function VendorSignupContent() {
  const isVenue = useSearchParams().get("type") === "venue";

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-2xl font-bold text-slate-900">
        {isVenue ? "Create your Venue Hub login" : "Create your vendor login"}
      </h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        {isVenue
          ? "Your venue gets its own flyer/hub — every show or event you host links straight back to it. Set up your account now; you can switch between Hosting Hub and Show Hub any time from your dashboard."
          : "This account is permanent — it's how you'll manage your CityPinned profile going forward. Already paid? Great — we'll activate your account after confirming your payment, but you can set everything up right now."}
      </p>
      <VendorSignupForm defaultHubType={isVenue ? "hosting" : undefined} />
    </div>
  );
}
