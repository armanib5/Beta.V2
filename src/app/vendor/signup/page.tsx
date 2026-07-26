import { VendorSignupForm } from "@/components/vendor-signup-form";

export default function VendorSignupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-2xl font-bold text-slate-900">Create your vendor login</h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        This account is permanent — it&apos;s how you&apos;ll manage your CityPinned profile going
        forward. Already paid? Great — we&apos;ll activate your account after confirming your
        payment, but you can set everything up right now.
      </p>
      <VendorSignupForm />
    </div>
  );
}
