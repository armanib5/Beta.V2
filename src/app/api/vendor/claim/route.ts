import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import type { PricingTier, Vendor } from "@/lib/types";

const bodySchema = z.object({
  sessionId: z.string().min(1),
});

/**
 * Turns a paid Stripe registration into a permanent vendor account. Must be
 * called with an authenticated Supabase session (the vendor just signed up)
 * — the registration's email is matched against that session's email so a
 * founding/Top 10 badge can only be claimed by the person who paid for it.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabaseAuth = await createServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: existingVendor } = await admin
    .from("vendors")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle<Pick<Vendor, "slug">>();

  if (existingVendor) {
    return NextResponse.json({ slug: existingVendor.slug });
  }

  const { data: registration } = await admin
    .from("registrations")
    .select("*")
    .eq("stripe_checkout_session_id", parsed.data.sessionId)
    .eq("status", "paid")
    .maybeSingle();

  if (!registration) {
    return NextResponse.json(
      { error: "No paid registration found for this checkout session." },
      { status: 404 },
    );
  }

  if (registration.contact_email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This registration was paid with a different email address." },
      { status: 403 },
    );
  }

  if (registration.claimed_by_vendor_id && registration.claimed_by_vendor_id !== user.id) {
    return NextResponse.json(
      { error: "This registration has already been claimed by another account." },
      { status: 409 },
    );
  }

  const { data: tier } = await admin
    .from("pricing_tiers")
    .select("*")
    .eq("id", registration.tier_id)
    .maybeSingle<PricingTier>();

  const businessName = registration.business_name ?? "New Vendor";
  const baseSlug = slugify(businessName);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 25; attempt++) {
    const { data: clash } = await admin
      .from("vendors")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: vendor, error: vendorError } = await admin
    .from("vendors")
    .insert({
      id: user.id,
      slug,
      business_name: businessName,
      contact_email: user.email,
      contact_phone: registration.contact_phone,
      status: "active",
      is_founding_vendor: tier?.is_founding ?? true,
      is_top10: registration.awarded_top10,
      tier_id: registration.tier_id,
      onboarded_at: new Date().toISOString(),
    })
    .select("slug")
    .single();

  if (vendorError || !vendor) {
    return NextResponse.json({ error: "Could not create vendor account." }, { status: 500 });
  }

  await admin
    .from("registrations")
    .update({ claimed_by_vendor_id: user.id })
    .eq("id", registration.id);

  return NextResponse.json({ slug: vendor.slug });
}
