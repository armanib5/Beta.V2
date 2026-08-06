"use client";

import { useRouter } from "next/navigation";

/** Returns exactly one level back (browser history), never all the way to
 * a dashboard/home - that's a separate, explicit choice the user makes on
 * its own link/button, not something "Back" should ever do for them. */
export function BackButton({ label = "Back", className = "" }: { label?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={`inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${className}`}
    >
      ← {label}
    </button>
  );
}
