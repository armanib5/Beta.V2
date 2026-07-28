"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The old standalone Vendor Directory is now folded into the unified
// /directory (all categories, city/neighborhood filter, search, Top 10 +
// Near Me) - this keeps the old URL working instead of a dead link.
export default function VendorDirectoryRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/directory");
  }, [router]);

  return <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Redirecting…</div>;
}
