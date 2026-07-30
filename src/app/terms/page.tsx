import Link from "next/link";

export const metadata = {
  title: "Terms of Service — CityPinned",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Terms of Service</h1>
      <p className="mt-1 text-xs text-slate-500">Version: v2_event_disclaimer_2026</p>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Event Non-Host &amp; Assumption of Risk Disclaimer</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          CityPinned, BayPinned, and its regional sister sites operate strictly as an interactive information
          directory and interactive navigation map. Neither CityPinned nor BayPinned host, organize, manage,
          control, staff, or supervise any physical events, venues, crowds, or vendor locations listed on the
          platform.
          {"\n\n"}
          By using this site, app, or map directory, you acknowledge and agree that CityPinned is not an event
          organizer and has zero control over crowd density, venue safety, physical hazards, or third-party
          vendor conduct. You assume full personal risk and responsibility for attending any location or public
          gathering. In no event shall CityPinned, BayPinned, its owners, or sister platforms be held liable for
          any personal injury, property damage, crowd incidents, or death occurring at or near any mapped
          location or event.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Payments &amp; Sales</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          All site placements and promotional fees (Founding Vendor, Top 10 / Featured placement, Quick Boost,
          Top 10 Placement, and any other paid upgrade) are final and non-refundable once activated. Payments
          are processed directly by Stripe; CityPinned and its sister networks do not hold or process funds
          themselves and cannot issue refunds, reverse transactions, or resolve financial disputes between
          parties. For payment issues, contact Stripe or your financial institution directly.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Questions</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Questions about these terms can be sent to{" "}
          <a href="mailto:citypinned@gmail.com" className="underline hover:no-underline">
            citypinned@gmail.com
          </a>
          .
        </p>
      </section>

      <Link href="/" className="mt-10 inline-block text-sm font-semibold text-slate-700 underline">
        ← Back to CityPinned
      </Link>
    </div>
  );
}
