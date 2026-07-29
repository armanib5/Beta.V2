"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/admin" || pathname === "/admin/";

  return (
    <div>
      {!isHome && (
        <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-4xl items-center px-4 py-2">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              🏠 Admin Home
            </Link>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
