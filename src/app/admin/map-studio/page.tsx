"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { MapStudio } from "@/components/map-studio";

type PinRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  status: string;
  lat: number;
  lng: number;
  vendor_id: string | null;
  event_id: string | null;
};

export default function AdminMapStudioPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [pins, setPins] = useState<PinRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const { data } = await supabase.from("pins").select("*").returns<PinRow[]>();
      if (cancelled) return;
      setPins(data ?? []);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Admin access required</h1>
        <Link href="/vendor/login" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Map Studio</h1>
      <p className="mt-1 text-sm text-slate-600">
        Add, edit, move, and remove map pins. Drag a pin to move it; click one to edit its details. This is Phase 1
        of the Map Studio — the same foundation will grow to manage event zones and booths later.
      </p>
      <div className="mt-6">
        <MapStudio initialPins={pins} />
      </div>
    </div>
  );
}
