"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ConfirmationPage() {
  const [receivedAt, setReceivedAt] = useState<string | null>(null);

  useEffect(() => {
    // Client-only on purpose — the server-rendered static export has no
    // "now", so this intentionally fills in after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReceivedAt(new Date().toLocaleString("en-US"));
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="text-5xl">✅</div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Payment Received — Thank You!</h1>
      <p className="mt-3 text-slate-600">
        Your account is being activated automatically — usually within seconds of payment
        clearing. Your Founding Vendor / Top 10 badge will show on your dashboard the moment
        it&apos;s done.
      </p>

      <div className="mt-4 w-full rounded-xl border border-dashed border-slate-300 bg-white p-4 text-left text-sm text-slate-500">
        <p className="font-semibold text-slate-700">Receipt confirmation</p>
        {receivedAt && <p className="mt-1">Received: {receivedAt}</p>}
        <p className="mt-1">Payment processed securely by Stripe — CityPinned never sees your card details.</p>
      </div>

      <Link
        href="/vendor/dashboard"
        className="mt-4 inline-block w-full rounded-full bg-slate-900 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700"
      >
        Go to My Dashboard
      </Link>
    </div>
  );
}
