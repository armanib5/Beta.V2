import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import type { PricingTier } from "@/lib/types";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing stripe-signature header");
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCheckoutCompleted(session);
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const registrationId = session.metadata?.registration_id;
  if (!registrationId) return;

  const supabase = createAdminClient();

  // Idempotency: skip if this registration is already marked paid (Stripe can
  // redeliver webhook events).
  const { data: registration } = await supabase
    .from("registrations")
    .select("id, status, tier_id")
    .eq("id", registrationId)
    .maybeSingle();

  if (!registration || registration.status === "paid") return;

  await supabase
    .from("registrations")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    })
    .eq("id", registrationId);

  const { data: tier } = await supabase
    .from("pricing_tiers")
    .select("*")
    .eq("id", registration.tier_id)
    .maybeSingle<PricingTier>();

  if (!tier) return;

  // Grant the Top 10 badge only while slots remain, first-paid-first-served.
  // claim_top10_slot does the check-and-increment as one atomic UPDATE so
  // concurrent webhook deliveries can't both grant the last spot.
  let awardedTop10 = false;
  if (tier.is_top10) {
    const { data: granted } = await supabase.rpc("claim_top10_slot", {
      p_tier_id: tier.id,
    });
    awardedTop10 = Boolean(granted);
  }

  // Persist the badge outcome so the confirmation screen and vendor-signup
  // flow can read it back without recomputing (and possibly double-granting).
  await supabase
    .from("registrations")
    .update({ awarded_top10: awardedTop10 })
    .eq("id", registrationId);
}
