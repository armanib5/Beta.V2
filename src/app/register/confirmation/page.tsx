import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice, type PricingTier, type Registration } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <StatusShell title="Missing checkout session" tone="error">
        <p>We couldn&apos;t find a payment session to confirm. If you just paid, check your email
        for a receipt, or contact us for help.</p>
      </StatusShell>
    );
  }

  const admin = createAdminClient();
  const { data: registration } = await admin
    .from("registrations")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle<Registration>();

  if (!registration) {
    return (
      <StatusShell title="We couldn't find that registration" tone="error">
        <p>Give it a minute and refresh this page — payments can take a few seconds to confirm.</p>
      </StatusShell>
    );
  }

  if (registration.status !== "paid") {
    return (
      <StatusShell title="Payment still processing" tone="pending">
        <p>
          We&apos;re confirming your payment with Stripe. This page will update automatically —
          try refreshing in a few seconds.
        </p>
      </StatusShell>
    );
  }

  const { data: tier } = await admin
    .from("pricing_tiers")
    .select("*")
    .eq("id", registration.tier_id)
    .maybeSingle<PricingTier>();

  return (
    <StatusShell title="Registration Confirmed" tone="success">
      <p className="text-lg font-semibold text-slate-900">Permanent Account Secured 🎉</p>
      <div className="mt-4 space-y-1 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-900">Business:</span>{" "}
          {registration.business_name}
        </p>
        <p>
          <span className="font-medium text-slate-900">Plan:</span> {tier?.name}
        </p>
        <p>
          <span className="font-medium text-slate-900">Amount paid:</span>{" "}
          {formatPrice(registration.amount_cents, registration.currency)}
        </p>
        {registration.awarded_top10 && (
          <p className="font-semibold text-amber-600">🏆 You earned the Top 10 Category badge!</p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
        <p className="text-sm font-semibold text-slate-900">Next: create your vendor login</p>
        <p className="mt-1 text-sm text-slate-600">
          Set a password for <span className="font-medium">{registration.contact_email}</span> so
          you can manage your profile, logo, photos, and category tags any time.
        </p>
        <Link
          href={`/vendor/signup?session_id=${encodeURIComponent(sessionId)}&email=${encodeURIComponent(
            registration.contact_email,
          )}`}
          className="mt-4 inline-block w-full rounded-full bg-slate-900 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700"
        >
          Create My Vendor Login
        </Link>
      </div>
    </StatusShell>
  );
}

function StatusShell({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "success" | "pending" | "error";
  children: React.ReactNode;
}) {
  const badge = { success: "✅", pending: "⏳", error: "⚠️" }[tone];
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="text-5xl">{badge}</div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{title}</h1>
      <div className="mt-3 w-full text-slate-600">{children}</div>
    </div>
  );
}
