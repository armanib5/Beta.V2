import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, siteUrl } from "@/lib/stripe";
import type { PricingTier } from "@/lib/types";

const bodySchema = z.object({
  tierSlug: z.string().min(1),
  businessName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(40).optional(),
});

/**
 * Creates a Stripe Checkout Session for a founding-vendor pre-order tier
 * and a matching `registrations` row. Used both for online "Pay Now" and
 * for the in-person iPad/phone flow, where the returned URL is rendered
 * as a QR code for the vendor to scan.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { tierSlug, businessName, contactEmail, contactPhone } = parsed.data;

  const supabase = createAdminClient();

  const { data: tier, error: tierError } = await supabase
    .from("pricing_tiers")
    .select("*")
    .eq("slug", tierSlug)
    .eq("is_active", true)
    .maybeSingle<PricingTier>();

  if (tierError || !tier) {
    return NextResponse.json({ error: "Unknown or inactive pricing tier." }, { status: 404 });
  }

  if (tier.max_slots !== null && tier.slots_claimed >= tier.max_slots) {
    return NextResponse.json(
      { error: `${tier.name} is sold out — all ${tier.max_slots} spots are claimed.` },
      { status: 409 },
    );
  }

  const { data: registration, error: registrationError } = await supabase
    .from("registrations")
    .insert({
      tier_id: tier.id,
      business_name: businessName,
      contact_email: contactEmail,
      contact_phone: contactPhone ?? null,
      amount_cents: tier.price_cents,
      currency: tier.currency,
      status: "pending",
    })
    .select("id")
    .single();

  if (registrationError || !registration) {
    return NextResponse.json({ error: "Could not create registration." }, { status: 500 });
  }

  const stripe = getStripe();
  const base = siteUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: contactEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: tier.currency,
          unit_amount: tier.price_cents,
          product_data: {
            name: `CityPinned — ${tier.name}`,
            description: tier.description ?? undefined,
          },
        },
      },
    ],
    metadata: {
      registration_id: registration.id,
      tier_id: tier.id,
      tier_slug: tier.slug,
    },
    success_url: `${base}/register/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/#pricing`,
  });

  await supabase
    .from("registrations")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", registration.id);

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
