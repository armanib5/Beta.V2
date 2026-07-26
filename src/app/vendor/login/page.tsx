import Link from "next/link";
import { VendorLoginForm } from "@/components/vendor-login-form";

export default function VendorLoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-2xl font-bold text-slate-900">Vendor Login</h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        Manage your CityPinned profile, photos, and category tags.
      </p>
      <VendorLoginForm />
      <p className="mt-6 text-center text-sm text-slate-600">
        Not a vendor yet?{" "}
        <Link href="/#pricing" className="font-semibold text-slate-900 underline">
          Become a Founding Vendor
        </Link>
      </p>
    </div>
  );
}
