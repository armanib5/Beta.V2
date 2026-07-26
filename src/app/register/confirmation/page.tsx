import Link from "next/link";

export default function ConfirmationPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="text-5xl">✅</div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Payment Received — Thank You!</h1>
      <p className="mt-3 text-slate-600">
        Your spot is being reserved. Set up your permanent vendor login now — we&apos;ll activate
        your account (and any Founding Vendor / Top 10 badge) after confirming your payment.
      </p>

      <div className="mt-6 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
        <p className="text-sm font-semibold text-slate-900">Next: create your vendor login</p>
        <p className="mt-1 text-sm text-slate-600">
          Use the same email you paid with, so it&apos;s easy to match up.
        </p>
        <Link
          href="/vendor/signup"
          className="mt-4 inline-block w-full rounded-full bg-slate-900 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700"
        >
          Create My Vendor Login
        </Link>
      </div>
    </div>
  );
}
