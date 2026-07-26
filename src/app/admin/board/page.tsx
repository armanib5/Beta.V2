"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import type { LovEntry } from "@/lib/types";
import { AdminBoard } from "@/components/admin-board";

export default function AdminBoardPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [events, setEvents] = useState<LovEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const { data } = await supabase
        .from("lov_entries")
        .select("*")
        .eq("type", "event")
        .order("event_date", { ascending: false })
        .returns<LovEntry[]>();
      if (cancelled) return;
      setEvents(data ?? []);
      setStatus("ready");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Admin access required</h1>
        <p className="mt-3 text-sm text-slate-600">
          Log in with an account listed in the <code>admins</code> table to manage the venue
          board.
        </p>
        <Link
          href="/vendor/login"
          className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Log In
        </Link>
      </div>
    );
  }

  return <AdminBoard events={events} />;
}
