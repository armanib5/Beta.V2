"use client";

/** Shared by every Stripe checkout entry point (vendor signup, Quick
 * Boost/Top 10 Placement, Founding/Featured tier upgrade) so the exact
 * required wording and enforcement can't drift between them. /terms
 * doesn't exist as a route in this app yet, so "Terms of Service" is
 * plain text here rather than a dead link — wire it to an <a>/<Link>
 * once that page exists. */
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
      <span>I agree to the Terms of Service and acknowledge that all sales are final and non-refundable.</span>
    </label>
  );
}
