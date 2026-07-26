import Link from "next/link";
import { VendorSignupForm } from "@/components/vendor-signup-form";

export default async function VendorSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; email?: string }>;
}) {
  const { session_id: sessionId, email } = await searchParams;

  if (!sessionId) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Pay first to create your login</h1>
        <p className="mt-3 text-sm text-slate-600">
          Vendor accounts are created after securing your spot with a one-time Founding Vendor
          payment. Already have an account?{" "}
          <Link href="/vendor/login" className="font-semibold text-slate-900 underline">
            Log in here
          </Link>
          .
        </p>
        <Link
          href="/#pricing"
          className="mt-6 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          View Pricing Tiers
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-2xl font-bold text-slate-900">Create your vendor login</h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        This account is permanent — it&apos;s how you&apos;ll manage your CityPinned profile going
        forward.
      </p>
      <VendorSignupForm sessionId={sessionId} initialEmail={email ?? ""} />
    </div>
  );
}
