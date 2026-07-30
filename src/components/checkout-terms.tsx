"use client";

import Link from "next/link";

/** Kept in sync with the server-side copy in worker/index.ts (used for the
 * account_legal_agreements audit rows) and the disclaimer text on
 * /terms — bump both together if the wording ever changes. */
export const TERMS_VERSION = "v2_event_disclaimer_2026";

/** Shared by every Stripe checkout entry point (vendor signup, Quick
 * Boost/Top 10 Placement, Founding/Featured tier upgrade) so the exact
 * required wording and enforcement can't drift between them. */
export function CheckoutTermsNotice() {
  return (
    <p className="text-xs font-medium text-slate-600">
      All site placements and promotional fees are final and non-refundable once activated.
    </p>
  );
}

export function CheckoutTermsCheckbox({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-xs text-slate-600">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
      />
      <span>
        I agree to the{" "}
        <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
          Terms of Service
        </Link>{" "}
        and acknowledge that all sales are final and non-refundable.
      </span>
    </label>
  );
}

/** The event non-host / assumption-of-risk acknowledgment - separate from
 * CheckoutTermsCheckbox above (a different legal concern: physical/event
 * liability, not payment finality), required everywhere an account is
 * created or a checkout is started. Every acceptance is logged to
 * account_legal_agreements (see worker/index.ts's logTermsAgreement). */
export function EventLiabilityCheckbox({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-xs text-slate-600">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
      />
      <span>
        I agree to the{" "}
        <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
          Terms of Service
        </Link>{" "}
        and acknowledge that CityPinned/BayPinned is an informational map directory only—not an event host or
        organizer—and assumes no liability for event attendance, crowd conditions, personal injury, or death.
      </span>
    </label>
  );
}
