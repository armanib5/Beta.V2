import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BoothStatus } from "@/lib/types";

const CYCLE: Record<BoothStatus, BoothStatus> = {
  open: "reserved",
  reserved: "claimed",
  claimed: "open",
};

/**
 * Admin-only: cycles a booth open -> reserved -> claimed -> open with one
 * tap, for marking booths "Occupied"/"Reserved" in front of a vendor at an
 * event. Clearing back to "open" also clears the claiming vendor.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: booth, error: fetchError } = await supabase
    .from("booths")
    .select("id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; status: BoothStatus }>();

  if (fetchError || !booth) {
    return NextResponse.json({ error: "Booth not found." }, { status: 404 });
  }

  const nextStatus = CYCLE[booth.status];

  const { data: updated, error: updateError } = await supabase
    .from("booths")
    .update({
      status: nextStatus,
      vendor_id: nextStatus === "open" ? null : undefined,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Could not update booth." }, { status: 500 });
  }

  return NextResponse.json({ booth: updated });
}
