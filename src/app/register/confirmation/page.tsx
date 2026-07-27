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
        Your permanent spot is being locked in right now. Set up your vendor login below —
        we&apos;ll activate your account (and any Founding Vendor / Top 10 badge) the moment your
        payment is confirmed on our end.
      </p>

      <div className="mt-4 w-full rounded-xl border border-dashed border-slate-300 bg-white p-4 text-left text-sm text-slate-500">
        <p className="font-semibold text-slate-700">Receipt confirmation</p>
        {receivedAt && <p className="mt-1">Received: {receivedAt}</p>}
        <p className="mt-1">Payment processed securely by Stripe — CityPinned never sees your card details.</p>
        <p className="mt-2 text-xs text-slate-400">
          Keep this page (or a screenshot) as your confirmation until your account is activated.
        </p>
      </div>

      <div className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
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
