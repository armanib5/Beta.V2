import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  eventId: z.string().uuid(),
  label: z.string().min(1).max(20),
  tier: z.enum(["top", "regular"]).default("regular"),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
});

/** Admin-only: add a booth to an event's board. */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: booth, error } = await supabase
    .from("booths")
    .insert({
      event_id: parsed.data.eventId,
      label: parsed.data.label,
      tier: parsed.data.tier,
      x: parsed.data.x ?? null,
      y: parsed.data.y ?? null,
    })
    .select("*")
    .single();

  if (error || !booth) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create booth (label may already exist for this event)." },
      { status: 400 },
    );
  }

  return NextResponse.json({ booth });
}
