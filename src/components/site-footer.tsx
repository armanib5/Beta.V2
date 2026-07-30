import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-4 text-center print:hidden">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <a
          href="mailto:citypinned@gmail.com?subject=CityPinned%20Bug%20Report%20%2F%20Feedback"
          className="text-xs font-semibold text-slate-500 underline hover:text-slate-700"
        >
          🐛 Report a Bug / Feedback
        </a>
        <Link href="/terms" className="text-xs font-semibold text-slate-500 underline hover:text-slate-700">
          Terms of Service
        </Link>
      </div>
    </footer>
  );
}
