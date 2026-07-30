/**
 * Cloudflare Worker for CityPinned V2.
 *
 * The Next.js app is a pure static export (output: "export") - there is no
 * server at request time, so it can't host API routes. Stripe Checkout
 * Session creation needs a real secret key, and the webhook needs to run
 * server-side too, so both live here instead: a small Worker that serves
 * the static site (via the ASSETS binding, unchanged from before) and adds
 * exactly two JSON API routes on top of it. No Stripe SDK dependency -
 * Checkout Sessions are created with a plain fetch to Stripe's REST API,
 * and webhook signatures are verified by hand with Web Crypto (HMAC-SHA256)
 * - both are simple enough to not need the SDK, and it sidesteps any
 * Node-API/Workers-runtime compatibility gaps that SDK carries.
 *
 * Secrets required (wrangler secret put <NAME>):
 *   STRIPE_SECRET_KEY        - sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET    - whsec_... (from the Stripe Dashboard, after
 *                               the endpoint below is registered there)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_URL              - e.g. https://xxxx.supabase.co (not secret,
 *                               but simplest to set the same way)
 */

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

// Every required secret has to be set (wrangler secret put ...) before
// either endpoint can do anything real. Without this check, a request
// hitting an unset SUPABASE_URL turns into fetch("undefined/rest/v1/...")
// - an unhandled exception that Cloudflare shows as an opaque "error code
// 1101" page instead of a message anyone could act on.
function missingEnvVars(env: Env): string[] {
  return (["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const).filter(
    (key) => !env[key],
  );
}

function sb(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set("authorization", `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set("content-type", "application/json");
  return fetch(`${env.SUPABASE_URL}/rest/v1${path}`, { ...init, headers });
}

// Flattens a nested object into Stripe's bracket-notation form fields,
// e.g. { line_items: [{ quantity: 1 }] } -> "line_items[0][quantity]=1".
// The Stripe REST API (outside the SDK) only accepts form-encoded bodies.
function toStripeForm(obj: Record<string, unknown>, prefix = ""): [string, string][] {
  const pairs: [string, string][] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const fieldKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === "object") {
          pairs.push(...toStripeForm(item as Record<string, unknown>, `${fieldKey}[${i}]`));
        } else {
          pairs.push([`${fieldKey}[${i}]`, String(item)]);
        }
      });
    } else if (typeof value === "object") {
      pairs.push(...toStripeForm(value as Record<string, unknown>, fieldKey));
    } else {
      pairs.push([fieldKey, String(value)]);
    }
  }
  return pairs;
}

async function stripeRequest(env: Env, path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const form = new URLSearchParams();
  for (const [k, v] of toStripeForm(body)) form.append(k, v);
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe API error (${res.status})`);
  return data;
}

const SLOT_MS = 10 * 60 * 1000;
const MAX_PER_SLOT = 5;

// Rounds a timestamp down to the 10-minute rotation boundary it falls in -
// applied to every slot regardless of source (client-picked or
// server-computed) so a slightly-off client timestamp can never land
// between buckets or dodge the capacity count for its real bucket.
function bucketStart(iso: string | number): number {
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  return Math.floor(t / SLOT_MS) * SLOT_MS;
}

function nextBucketStart(fromMs: number): number {
  return Math.ceil(fromMs / SLOT_MS) * SLOT_MS;
}

// One REST round-trip for however many buckets are being checked/booked -
// counts existing rows per bucket so a slot already at MAX_PER_SLOT can be
// rejected before Stripe is ever involved.
async function bookedCounts(env: Env, bucketStartsMs: number[]): Promise<Map<number, number>> {
  if (bucketStartsMs.length === 0) return new Map();
  const isoList = bucketStartsMs.map((ms) => new Date(ms).toISOString());
  const res = await sb(env, `/vendor_boost_bookings?slot_start=in.(${isoList.join(",")})&select=slot_start`);
  const rows = (await res.json()) as Array<{ slot_start: string }>;
  const counts = new Map<number, number>();
  for (const ms of bucketStartsMs) counts.set(ms, 0);
  for (const row of rows) {
    const ms = bucketStart(row.slot_start);
    counts.set(ms, (counts.get(ms) ?? 0) + 1);
  }
  return counts;
}

async function handleCreateCheckoutSession(request: Request, env: Env): Promise<Response> {
  let body: { vendor_id?: string; tier_id?: string; slots?: string[]; terms_accepted?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const vendorId = body.vendor_id;
  const tierId = body.tier_id;
  if (!vendorId || !tierId) return json({ error: "vendor_id and tier_id are required." }, 400);
  // Server-side backstop behind the disabled-until-checked button in every
  // checkout UI (signup, Quick Boost/Top 10 Placement, Founding/Featured
  // upgrade) - all three funnel through this one endpoint, so enforcing it
  // here once covers every entry point instead of trusting client state.
  if (body.terms_accepted !== true) return json({ error: "You must accept the Terms of Service to check out." }, 400);

  const [vendorRes, tierRes] = await Promise.all([
    sb(env, `/vendors?id=eq.${vendorId}&select=id,business_name,contact_email`),
    sb(env, `/pricing_tiers?id=eq.${tierId}&is_active=eq.true&select=*`),
  ]);
  const [vendors, tiers] = (await Promise.all([vendorRes.json(), tierRes.json()])) as [
    Array<{ id: string; business_name: string; contact_email: string }>,
    Array<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      price_cents: number;
      currency: string;
      is_top10: boolean;
      is_founding: boolean;
      max_slots: number | null;
    }>,
  ];
  const vendor = vendors[0];
  const tier = tiers[0];
  if (!vendor) return json({ error: "Vendor not found." }, 404);
  if (!tier) return json({ error: "Pricing tier not found or inactive." }, 404);

  // Quick Vendor Boost ($15/20-min) and Top 10 Placement ($30/30-min) both
  // show CityPinned's cut as its own itemized line at checkout rather than
  // folding it into the price.
  const isBoost = tier.slug === "vendor-boost";
  const isPlacement = tier.slug === "top10-30min";
  const platformFeeCents = isBoost || isPlacement ? 100 : 0;

  // Quick Boost: the vendor picks exactly 2 of the 10-minute slots shown
  // available in the dashboard. Top 10 Placement: always 3 consecutive
  // slots starting right now - never client-supplied, so there's no path
  // for a request to claim a slot other than "starting immediately".
  let slotStartsMs: number[] = [];
  if (isBoost) {
    const requested = Array.isArray(body.slots) ? body.slots : [];
    if (requested.length !== 2) return json({ error: "Pick exactly 2 boost slots." }, 400);
    slotStartsMs = [...new Set(requested.map((s) => bucketStart(s)))];
    if (slotStartsMs.length !== 2) return json({ error: "Boost slots must be 2 different 10-minute windows." }, 400);
    if (slotStartsMs.some((ms) => ms <= Date.now())) return json({ error: "Boost slots must be in the future." }, 400);
  } else if (isPlacement) {
    const start = nextBucketStart(Date.now());
    slotStartsMs = [start, start + SLOT_MS, start + 2 * SLOT_MS];
  }

  if (slotStartsMs.length > 0) {
    const counts = await bookedCounts(env, slotStartsMs);
    const full = slotStartsMs.filter((ms) => (counts.get(ms) ?? 0) >= MAX_PER_SLOT);
    if (full.length > 0) {
      return json({ error: `Slot(s) starting ${full.map((ms) => new Date(ms).toISOString()).join(", ")} just filled up - pick another.` }, 409);
    }
  }

  const regRes = await sb(env, "/registrations", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      tier_id: tierId,
      claimed_by_vendor_id: vendorId,
      business_name: vendor.business_name,
      contact_email: vendor.contact_email,
      amount_cents: tier.price_cents + platformFeeCents,
      currency: tier.currency ?? "usd",
      status: "pending",
    }),
  });
  if (!regRes.ok) return json({ error: `Could not start registration: ${await regRes.text()}` }, 500);
  const [registration] = (await regRes.json()) as Array<{ id: string }>;
  if (!registration) return json({ error: "Could not start registration." }, 500);

  const origin = new URL(request.url).origin;
  const lineItems: Record<string, unknown>[] = [
    {
      quantity: 1,
      price_data: {
        currency: tier.currency ?? "usd",
        unit_amount: tier.price_cents,
        product_data: { name: tier.name, description: tier.description ?? undefined },
      },
    },
  ];
  if (platformFeeCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: tier.currency ?? "usd",
        unit_amount: platformFeeCents,
        product_data: { name: "CityPinned Platform Fee" },
      },
    });
  }

  let session: { id: string; url: string };
  try {
    session = (await stripeRequest(env, "checkout/sessions", {
      mode: "payment",
      customer_email: vendor.contact_email,
      client_reference_id: vendorId,
      line_items: lineItems,
      metadata: {
        vendor_id: vendorId,
        tier_id: tierId,
        registration_id: registration.id,
        slots: slotStartsMs.length > 0 ? JSON.stringify(slotStartsMs.map((ms) => new Date(ms).toISOString())) : undefined,
      },
      success_url: `${origin}/register/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/vendor/dashboard`,
    })) as { id: string; url: string };
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Stripe error." }, 502);
  }

  await sb(env, `/registrations?id=eq.${registration.id}`, {
    method: "PATCH",
    body: JSON.stringify({ stripe_checkout_session_id: session.id }),
  });

  // Timestamped record that this vendor accepted the Terms of Service and
  // started checkout, independent of the separate "Stripe payment
  // completed" entry logged later by the webhook - covers all three
  // checkout entry points since they all call this one function.
  await sb(env, "/activity_log", {
    method: "POST",
    body: JSON.stringify({
      entity_type: "vendor",
      entity_id: vendorId,
      entity_name: vendor.business_name,
      action: "Accepted Terms of Service — started checkout",
      detail: `${tier.name} — $${((tier.price_cents + platformFeeCents) / 100).toFixed(2)}`,
    }),
  }).catch(() => {});

  return json({ url: session.url });
}

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } {
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",").map((p) => p.trim())) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = v;
    else if (k === "v1") signatures.push(v);
  }
  return { timestamp, signatures };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(payload: string, header: string, secret: string, toleranceSeconds = 300): Promise<boolean> {
  const { timestamp, signatures } = parseSignatureHeader(header);
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(signatureBytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const signatureHeader = request.headers.get("stripe-signature");
  const payload = await request.text();
  if (!signatureHeader || !(await verifyStripeSignature(payload, signatureHeader, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: "Invalid signature." }, 400);
  }

  type CheckoutSession = {
    id: string;
    payment_intent: string | { id: string } | null;
    client_reference_id: string | null;
    metadata: { vendor_id?: string; tier_id?: string; slots?: string } | null;
  };
  let event: { type: string; data: { object: CheckoutSession } };
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Invalid payload." }, 400);
  }

  if (event.type !== "checkout.session.completed") return json({ received: true });

  const session = event.data.object;
  const vendorId = session.metadata?.vendor_id ?? session.client_reference_id ?? undefined;
  const tierId = session.metadata?.tier_id ?? undefined;

  if (!vendorId || !tierId) {
    console.error("Webhook missing vendor_id/tier_id in metadata", session.id);
    return json({ received: true }); // nothing actionable - ack so Stripe stops retrying
  }

  try {
    // Idempotency - Stripe redelivers events, sometimes more than once.
    const existingRes = await sb(env, `/registrations?stripe_checkout_session_id=eq.${session.id}&select=id,status`);
    const [existing] = (await existingRes.json()) as Array<{ id: string; status: string }>;
    if (existing?.status === "paid") return json({ received: true, alreadyProcessed: true });

    const [tierRes, vendorRes] = await Promise.all([
      sb(env, `/pricing_tiers?id=eq.${tierId}&select=*`),
      sb(env, `/vendors?id=eq.${vendorId}&select=*`),
    ]);
    const [tier] = (await tierRes.json()) as Array<{
      slug: string;
      name: string;
      is_top10: boolean;
      is_founding: boolean;
      max_slots: number | null;
    }>;
    const [vendor] = (await vendorRes.json()) as Array<{
      business_name: string;
      is_founding_vendor: boolean;
      is_top10: boolean;
      is_featured: boolean;
      category_tier: string;
    }>;
    if (!tier || !vendor) throw new Error(`Tier or vendor not found (tier=${tierId}, vendor=${vendorId})`);

    const usesSlots = tier.slug === "vendor-boost" || tier.slug === "top10-30min";

    // Quick Vendor Boost and Top 10 Placement are slot-scheduled, parallel-
    // friendly visibility bumps on top of whatever the vendor's account
    // already is - they must NOT touch approval status, tier_id, or the
    // permanent Top 10/Founding flags, unlike the $50/$100 tiers below
    // which do exactly that. Their booking rows (not a vendor column) are
    // the source of truth for "boosted right now", since a slot can be
    // scheduled for later rather than starting immediately.
    if (usesSlots) {
      let slots: string[] = [];
      try {
        slots = session.metadata?.slots ? JSON.parse(session.metadata.slots) : [];
      } catch {
        slots = [];
      }
      if (slots.length === 0) throw new Error(`Paid ${tier.slug} checkout with no slots in metadata (session=${session.id})`);
      const bookingRows = slots.map((slotStart) => ({
        vendor_id: vendorId,
        tier_id: tierId,
        registration_id: existing?.id ?? null,
        slot_start: slotStart,
        slot_end: new Date(new Date(slotStart).getTime() + SLOT_MS).toISOString(),
      }));
      const bookingRes = await sb(env, "/vendor_boost_bookings", { method: "POST", body: JSON.stringify(bookingRows) });
      if (!bookingRes.ok) throw new Error(`Booking insert failed: ${await bookingRes.text()}`);
    } else {
      const vendorPatchBody = {
        status: "active",
        approved_at: new Date().toISOString(),
        tier_id: tierId,
        is_founding_vendor: vendor.is_founding_vendor || tier.is_founding,
        is_top10: vendor.is_top10 || tier.is_top10,
        is_featured: vendor.is_featured || tier.is_top10,
        category_tier: tier.is_top10 ? "top_10" : vendor.category_tier,
      };
      const vendorPatchRes = await sb(env, `/vendors?id=eq.${vendorId}`, {
        method: "PATCH",
        body: JSON.stringify(vendorPatchBody),
      });
      if (!vendorPatchRes.ok) throw new Error(`Vendor update failed: ${await vendorPatchRes.text()}`);
    }

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
    const regPatchBody = {
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
      awarded_top10: !usesSlots && tier.is_top10,
    };
    const regPatchRes = existing
      ? await sb(env, `/registrations?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify(regPatchBody) })
      : await sb(env, `/registrations?stripe_checkout_session_id=eq.${session.id}`, { method: "PATCH", body: JSON.stringify(regPatchBody) });
    if (!regPatchRes.ok) throw new Error(`Registration update failed: ${await regPatchRes.text()}`);

    if (!usesSlots && tier.is_top10 && tier.max_slots !== null) {
      await sb(env, "/rpc/claim_top10_slot", { method: "POST", body: JSON.stringify({ p_tier_id: tierId }) }).catch(() => {});
    }

    await sb(env, "/activity_log", {
      method: "POST",
      body: JSON.stringify({
        entity_type: "vendor",
        entity_id: vendorId,
        entity_name: vendor.business_name,
        action: "Stripe payment completed",
        detail: `${tier.name} — session ${session.id}`,
      }),
    }).catch(() => {});

    return json({ received: true });
  } catch (err) {
    console.error("Webhook processing failed", err);
    // 500 so Stripe retries on its standard backoff schedule - a silently
    // dropped payment (vendor stuck pending despite a real charge) is far
    // worse than a duplicate retry, which the idempotency check above
    // already guards against.
    return json({ error: "Processing failed." }, 500);
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isApiRoute = url.pathname === "/api/create-checkout-session" || url.pathname === "/api/stripe-webhook";
    if (!isApiRoute || request.method !== "POST") return env.ASSETS.fetch(request);

    const missing = missingEnvVars(env);
    if (missing.length > 0) {
      return json({ error: `Payment isn't configured yet - missing: ${missing.join(", ")}.` }, 503);
    }

    try {
      if (url.pathname === "/api/create-checkout-session") return await handleCreateCheckoutSession(request, env);
      return await handleStripeWebhook(request, env);
    } catch (err) {
      // Whatever the reason, never let an exception escape to Cloudflare's
      // opaque "error code 1101" page - a real caller (browser or Stripe)
      // needs a JSON body it can show or retry on.
      console.error("Unhandled API error", err);
      return json({ error: "Internal error." }, 500);
    }
  },
};

export default worker;
