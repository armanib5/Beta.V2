import Link from "next/link";
import { getAdminUser } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import type { LovEntry } from "@/lib/types";
import { AdminBoard } from "@/components/admin-board";

export const dynamic = "force-dynamic";

export default async function AdminBoardPage() {
  const admin = await getAdminUser();

  if (!admin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Admin access required</h1>
        <p className="mt-3 text-sm text-slate-600">
          Log in with an account listed in <code>ADMIN_EMAILS</code> to manage the venue board.
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

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("lov_entries")
    .select("*")
    .eq("type", "event")
    .order("event_date", { ascending: false })
    .returns<LovEntry[]>();

  return <AdminBoard events={events ?? []} />;
}
