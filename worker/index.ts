/**
 * Cloudflare Worker for CityPinned V2.
 *
 * The Next.js app is a pure static export (output: "export") - there is no
 * server at request time, so it can't host API routes. Stripe Checkout
 * Session creation needs a real secret key, and the webhook needs to run
 * server-side too, so both live here instead: a small Worker that serves
 * the static site (via the ASSETS binding, unchanged from before) and adds
 * a small number of JSON API routes on top of it. No Stripe SDK dependency -
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
// 1101" page instead of a message anyone could act on. Takes an explicit
// key list so a Supabase-only route (like logging a terms agreement)
// doesn't get blocked on Stripe secrets it never touches.
function missingEnvVars(env: Env, required: (keyof Env)[] = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]): string[] {
  return required.filter((key) => !env[key]);
}

// The version string logged to account_legal_agreements every time someone
// checks the event non-host / assumption-of-risk box (signup or checkout) -
// bump this if the disclaimer text in src/app/terms/page.tsx ever changes,
// so old rows stay an accurate record of what was actually agreed to.
const TERMS_VERSION = "v2_event_disclaimer_2026";

// Flat $1.00 platform processing fee, itemized as its own Stripe line item
// on every checkout on this project (not just Quick Boost/Top 10
// Placement, which is all it used to cover). Mirrored in src/lib/fees.ts
// - that file lives in the Next.js bundle, this one's a separate esbuild
// bundle, so the value has to be kept in sync by hand in both places.
const PLATFORM_FEE_CENTS = 100;

// Stripe's standard published card rate (2.9% + $0.30) - an estimate
// stored for reporting/reconciliation, not pulled from Stripe's real
// Balance Transaction API (which can vary slightly by card type/region),
// same simplification the requesting spec asked for.
function estimateStripeFeeCents(grossCents: number): number {
  return Math.round(grossCents * 0.029) + 30;
}

/** Fire-and-forget by design (same pattern as the existing activity_log
 * writes in this file) - a logging failure should never block a real
 * signup or checkout. CF-Connecting-IP is set by Cloudflare on every
 * request reaching a Worker, so this is a real observed IP, not a
 * client-reported (and therefore spoofable) one. */
function logTermsAgreement(env: Env, request: Request, userId: string): Promise<Response> {
  return sb(env, "/account_legal_agreements", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      terms_version: TERMS_VERSION,
      user_ip: request.headers.get("CF-Connecting-IP"),
    }),
  });
}

function sb(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set("authorization", `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set("content-type", "application/json");
  return fetch(`${env.SUPABASE_URL}/rest/v1${path}`, { ...init, headers });
}

// Resolves the caller's Supabase Auth id from the request's own bearer
// token - same check handleAdminCreateBusiness already used, pulled out
// so handleCreateCheckoutSession/handleCreateCartCheckoutSession/
// handleLogTermsAgreement can each verify the caller genuinely IS the
// vendor_id in their own request body, instead of trusting it unchecked
// (launch-hardening audit finding: any of those three routes previously
// accepted any vendor_id with zero caller verification).
async function resolveAuthenticatedCallerId(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const callerRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: authHeader },
  });
  if (!callerRes.ok) return null;
  const caller = (await callerRes.json()) as { id?: string };
  return caller.id ?? null;
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

  // The caller has to genuinely BE this vendor - previously any vendor_id
  // was accepted unchecked (launch-hardening audit finding).
  const callerId = await resolveAuthenticatedCallerId(request, env);
  if (!callerId) return json({ error: "Not signed in." }, 401);
  if (callerId !== vendorId) return json({ error: "You can only start checkout for your own account." }, 403);

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

  const isBoost = tier.slug === "vendor-boost";
  const isPlacement = tier.slug === "top10-30min";
  const platformFeeCents = PLATFORM_FEE_CENTS;

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
        product_data: { name: "Platform Processing Fee" },
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

  // Event non-host / assumption-of-risk disclaimer acceptance - a separate
  // audit trail from the activity_log entry above (that one's about the
  // sale being final; this one's specifically the event-liability
  // acknowledgment required at every checkout, same as at signup).
  await logTermsAgreement(env, request, vendorId).catch(() => {});

  return json({ url: session.url });
}

// Slot-based tiers (Quick Boost, Top 10 Placement) need a per-item slot
// picker and aren't cart-compatible yet - mirrored in src/lib/fees.ts.
const CART_INELIGIBLE_TIER_SLUGS = ["vendor-boost", "top10-30min"];

/** Cart checkout - phase 1 of the cart architecture. A completely separate
 * function from handleCreateCheckoutSession above, on its own route, so
 * the existing single-item checkout is never touched by anything in
 * here. Pays for every tier currently in the vendor's cart_items in ONE
 * Stripe session with ONE $1.00 platform fee, instead of one fee per
 * item. */
async function handleCreateCartCheckoutSession(request: Request, env: Env): Promise<Response> {
  let body: { vendor_id?: string; terms_accepted?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const vendorId = body.vendor_id;
  if (!vendorId) return json({ error: "vendor_id is required." }, 400);

  const callerId = await resolveAuthenticatedCallerId(request, env);
  if (!callerId) return json({ error: "Not signed in." }, 401);
  if (callerId !== vendorId) return json({ error: "You can only start checkout for your own account." }, 403);

  if (body.terms_accepted !== true) return json({ error: "You must accept the Terms of Service to check out." }, 400);

  const [vendorRes, cartRes] = await Promise.all([
    sb(env, `/vendors?id=eq.${vendorId}&select=id,business_name,contact_email`),
    sb(
      env,
      `/cart_items?vendor_id=eq.${vendorId}&select=id,tier_id,pricing_tiers(id,slug,name,description,price_cents,currency,is_active)`,
    ),
  ]);
  const [vendors] = [(await vendorRes.json()) as Array<{ id: string; business_name: string; contact_email: string }>];
  const vendor = vendors[0];
  if (!vendor) return json({ error: "Vendor not found." }, 404);

  const cartRows = (await cartRes.json()) as Array<{
    id: string;
    tier_id: string;
    pricing_tiers: {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      price_cents: number;
      currency: string;
      is_active: boolean;
    } | null;
  }>;
  if (cartRows.length === 0) return json({ error: "Your cart is empty." }, 400);

  const items = cartRows
    .map((row) => row.pricing_tiers)
    .filter((tier): tier is NonNullable<typeof tier> => tier !== null);
  const ineligible = items.find((t) => CART_INELIGIBLE_TIER_SLUGS.includes(t.slug));
  if (ineligible) {
    return json({ error: `"${ineligible.name}" needs to be purchased on its own (it needs a time slot picked), not through the cart.` }, 400);
  }
  const inactive = items.find((t) => !t.is_active);
  if (inactive) return json({ error: `"${inactive.name}" is no longer available - remove it from your cart.` }, 400);

  const currency = items[0]?.currency ?? "usd";
  const platformFeeCents = PLATFORM_FEE_CENTS;

  // One registration row per cart item (keeps every existing report/
  // receipt view - which reads registrations one row at a time - working
  // unchanged for cart orders too), all sharing one Stripe session id.
  const regRes = await sb(env, "/registrations", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(
      items.map((tier) => ({
        tier_id: tier.id,
        claimed_by_vendor_id: vendorId,
        business_name: vendor.business_name,
        contact_email: vendor.contact_email,
        amount_cents: tier.price_cents,
        currency: tier.currency ?? "usd",
        status: "pending",
      })),
    ),
  });
  if (!regRes.ok) return json({ error: `Could not start registration: ${await regRes.text()}` }, 500);
  const registrations = (await regRes.json()) as Array<{ id: string }>;
  if (registrations.length !== items.length) return json({ error: "Could not start registration for every cart item." }, 500);

  const origin = new URL(request.url).origin;
  const lineItems: Record<string, unknown>[] = items.map((tier) => ({
    quantity: 1,
    price_data: {
      currency: tier.currency ?? "usd",
      unit_amount: tier.price_cents,
      product_data: { name: tier.name, description: tier.description ?? undefined },
    },
  }));
  lineItems.push({
    quantity: 1,
    price_data: { currency, unit_amount: platformFeeCents, product_data: { name: "Platform Processing Fee" } },
  });

  let session: { id: string; url: string };
  try {
    session = (await stripeRequest(env, "checkout/sessions", {
      mode: "payment",
      customer_email: vendor.contact_email,
      client_reference_id: vendorId,
      line_items: lineItems,
      metadata: {
        vendor_id: vendorId,
        is_cart: "true",
        registration_ids: JSON.stringify(registrations.map((r) => r.id)),
      },
      success_url: `${origin}/register/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/vendor/dashboard`,
    })) as { id: string; url: string };
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Stripe error." }, 502);
  }

  await sb(env, `/registrations?id=in.(${registrations.map((r) => r.id).join(",")})`, {
    method: "PATCH",
    body: JSON.stringify({ stripe_checkout_session_id: session.id }),
  });

  const itemsTotalCents = items.reduce((sum, t) => sum + t.price_cents, 0);
  await sb(env, "/activity_log", {
    method: "POST",
    body: JSON.stringify({
      entity_type: "vendor",
      entity_id: vendorId,
      entity_name: vendor.business_name,
      action: "Accepted Terms of Service — started cart checkout",
      detail: `${items.length} item${items.length === 1 ? "" : "s"} (${items.map((t) => t.name).join(", ")}) — $${((itemsTotalCents + platformFeeCents) / 100).toFixed(2)}`,
    }),
  }).catch(() => {});

  await logTermsAgreement(env, request, vendorId).catch(() => {});

  // Cart clears once checkout has actually started - if the vendor
  // abandons the Stripe page, they're back to an empty cart the same way
  // most cart abandonment works elsewhere; re-adding items is one click
  // each in "My Cart".
  await sb(env, `/cart_items?vendor_id=eq.${vendorId}`, { method: "DELETE" }).catch(() => {});

  return json({ url: session.url });
}

/** Called once right after a new vendor account is created, since that
 * signup happens via supabase.auth.signUp() straight from the browser
 * (no server involved) and so has no other point where a real
 * server-observed IP could be captured for the audit row. */
async function handleLogTermsAgreement(request: Request, env: Env): Promise<Response> {
  let body: { vendor_id?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (!body.vendor_id) return json({ error: "vendor_id is required." }, 400);

  const callerId = await resolveAuthenticatedCallerId(request, env);
  if (!callerId) return json({ error: "Not signed in." }, 401);
  if (callerId !== body.vendor_id) return json({ error: "You can only log agreement for your own account." }, 403);

  const res = await logTermsAgreement(env, request, body.vendor_id);
  if (!res.ok) return json({ error: `Could not log agreement: ${await res.text()}` }, 500);
  return json({ ok: true });
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "vendor"
  );
}

/** Admin-only: provisions a Business ID + PIN credential from scratch.
 * Nothing in this codebase could do this before - confirmed by a full
 * repo search - the 20 existing Host Hub vendor rows (migration 0036)
 * only work because their auth.users rows were created by hand, out of
 * band, undocumented. vendors.id is a hard FK to auth.users.id (migration
 * 0001), so the auth user has to be created first via the Supabase Admin
 * Auth API (only the service-role key can do this - never exposed to the
 * browser), then the vendors row with that same id, same shape as the
 * browser's own self-signup insert in vendor-signup-form.tsx. None of the
 * other /api/* routes authenticate their caller at all (see file header);
 * this is the first one that has to, since it's a genuinely privileged
 * action - so unlike them, it requires a bearer token identifying an
 * admin, checked against the same `admins` table every RLS policy and
 * checkIsAdmin() already trust. */
async function handleAdminCreateBusiness(request: Request, env: Env): Promise<Response> {
  const callerId = await resolveAuthenticatedCallerId(request, env);
  if (!callerId) return json({ error: "Invalid session." }, 401);

  const adminRes = await sb(env, `/admins?id=eq.${callerId}&select=id`);
  const admins = (await adminRes.json()) as Array<{ id: string }>;
  if (admins.length === 0) return json({ error: "Admin access required." }, 403);

  let body: {
    business_name?: string;
    pin?: string;
    category_id?: string;
    lat?: number;
    lng?: number;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const businessName = body.business_name?.trim();
  if (!businessName) return json({ error: "business_name is required." }, 400);

  const pin = (body.pin?.trim() || String(Math.floor(100000 + Math.random() * 900000))).slice(0, 20);
  if (pin.length < 4) return json({ error: "PIN must be at least 4 characters." }, 400);

  // Business ID (the slug) has to be unique the same way vendor-signup-
  // form.tsx retries on a slug collision - reused here rather than a new
  // scheme, since this is the same vendors.slug column.
  const baseSlug = slugify(businessName);
  let slug = baseSlug;
  let email = `${slug}@vendor.citypinned.app`;
  let newUserId: string | null = null;
  for (let attempt = 0; attempt < 5 && !newUserId; attempt++) {
    if (attempt > 0) {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      email = `${slug}@vendor.citypinned.app`;
    }
    const createUserRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password: pin, email_confirm: true }),
    });
    if (createUserRes.ok) {
      const newUser = (await createUserRes.json()) as { id: string };
      newUserId = newUser.id;
      break;
    }
    const errText = await createUserRes.text();
    if (!errText.toLowerCase().includes("already been registered") && !errText.toLowerCase().includes("already exists")) {
      return json({ error: `Could not create login: ${errText}` }, 502);
    }
    // email collision - loop and retry with a suffixed slug
  }
  if (!newUserId) return json({ error: "Could not find an available Business ID after several attempts." }, 500);

  const vendorRes = await sb(env, "/vendors", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      id: newUserId,
      slug,
      business_name: businessName,
      contact_email: email,
      status: "pending",
      entity_type: "vendor",
      hub_type: "vendor",
      lat: body.lat ?? null,
      lng: body.lng ?? null,
    }),
  });
  if (!vendorRes.ok) {
    const errText = await vendorRes.text();
    return json({ error: `Login created, but the business listing failed: ${errText}` }, 500);
  }
  const [vendor] = (await vendorRes.json()) as Array<{ id: string; slug: string }>;

  if (body.category_id) {
    await sb(env, "/vendor_categories", {
      method: "POST",
      body: JSON.stringify({ vendor_id: vendor.id, category_id: body.category_id }),
    }).catch(() => {});
  }

  await sb(env, "/activity_log", {
    method: "POST",
    body: JSON.stringify({
      entity_type: "vendor",
      entity_id: vendor.id,
      entity_name: businessName,
      action: "Admin created Business ID + PIN",
      detail: `Business ID: ${vendor.slug}`,
    }),
  }).catch(() => {});

  return json({ business_id: vendor.slug, pin, vendor_id: vendor.id });
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

type CheckoutSession = {
  id: string;
  payment_intent: string | { id: string } | null;
  client_reference_id: string | null;
  metadata: { vendor_id?: string; tier_id?: string; slots?: string; is_cart?: string; registration_ids?: string } | null;
};

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const signatureHeader = request.headers.get("stripe-signature");
  const payload = await request.text();
  if (!signatureHeader || !(await verifyStripeSignature(payload, signatureHeader, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: "Invalid signature." }, 400);
  }

  let event: { type: string; data: { object: CheckoutSession } };
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Invalid payload." }, 400);
  }

  if (event.type !== "checkout.session.completed") return json({ received: true });

  const session = event.data.object;

  // Cart checkouts (multiple tiers, one Stripe session) branch off here to
  // their own handler and never fall through to the single-item logic
  // below - that logic is completely unchanged/untouched for every
  // existing checkout, which never sets is_cart in its metadata.
  if (session.metadata?.is_cart === "true") {
    return handleCartCheckoutCompleted(session, env);
  }

  const vendorId = session.metadata?.vendor_id ?? session.client_reference_id ?? undefined;
  const tierId = session.metadata?.tier_id ?? undefined;

  if (!vendorId || !tierId) {
    console.error("Webhook missing vendor_id/tier_id in metadata", session.id);
    return json({ received: true }); // nothing actionable - ack so Stripe stops retrying
  }

  try {
    // Idempotency - Stripe redelivers events, sometimes more than once.
    const existingRes = await sb(env, `/registrations?stripe_checkout_session_id=eq.${session.id}&select=id,status,amount_cents`);
    const [existing] = (await existingRes.json()) as Array<{ id: string; status: string; amount_cents: number }>;
    if (existing?.status === "paid") return json({ received: true, alreadyProcessed: true });

    const [tierRes, vendorRes] = await Promise.all([
      sb(env, `/pricing_tiers?id=eq.${tierId}&select=*`),
      sb(env, `/vendors?id=eq.${vendorId}&select=*`),
    ]);
    const [tier] = (await tierRes.json()) as Array<{
      slug: string;
      name: string;
      price_cents: number;
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
    const grossCents = existing?.amount_cents ?? tier.price_cents + PLATFORM_FEE_CENTS;
    const stripeFeeCents = estimateStripeFeeCents(grossCents);
    const regPatchBody = {
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
      awarded_top10: !usesSlots && tier.is_top10,
      stripe_fee_cents: stripeFeeCents,
      platform_fee_cents: PLATFORM_FEE_CENTS,
      net_payout_cents: grossCents - stripeFeeCents - PLATFORM_FEE_CENTS,
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

/** Cart order payment completed - a separate function the webhook
 * delegates to before it ever reaches the single-item logic above, so
 * that logic runs exactly as it always has for every non-cart checkout. */
async function handleCartCheckoutCompleted(session: CheckoutSession, env: Env): Promise<Response> {
  const vendorId = session.metadata?.vendor_id ?? session.client_reference_id ?? undefined;
  let registrationIds: string[] = [];
  try {
    registrationIds = session.metadata?.registration_ids ? JSON.parse(session.metadata.registration_ids) : [];
  } catch {
    registrationIds = [];
  }
  if (!vendorId || registrationIds.length === 0) {
    console.error("Cart webhook missing vendor_id/registration_ids in metadata", session.id);
    return json({ received: true });
  }

  try {
    const idsFilter = registrationIds.join(",");
    const [regsRes, vendorRes] = await Promise.all([
      sb(env, `/registrations?id=in.(${idsFilter})&select=id,status,amount_cents,tier_id,pricing_tiers(name,is_top10,is_founding,price_cents)`),
      sb(env, `/vendors?id=eq.${vendorId}&select=*`),
    ]);
    const registrations = (await regsRes.json()) as Array<{
      id: string;
      status: string;
      amount_cents: number;
      tier_id: string;
      pricing_tiers: { name: string; is_top10: boolean; is_founding: boolean; price_cents: number } | null;
    }>;
    const [vendor] = (await vendorRes.json()) as Array<{
      business_name: string;
      is_founding_vendor: boolean;
      is_top10: boolean;
      is_featured: boolean;
      category_tier: string;
    }>;
    if (registrations.length === 0 || !vendor) throw new Error(`Cart registrations or vendor not found (vendor=${vendorId}, session=${session.id})`);
    if (registrations[0].status === "paid") return json({ received: true, alreadyProcessed: true });

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
    const itemsTotalCents = registrations.reduce((sum, r) => sum + r.amount_cents, 0);
    const grossCents = itemsTotalCents + PLATFORM_FEE_CENTS;
    const stripeFeeTotalCents = estimateStripeFeeCents(grossCents);

    // Same OR-together pattern the single-item path uses for the boolean
    // badges - multiple flag-granting tiers in one cart just OR cleanly.
    // vendors.tier_id is a single column though, so it can't point at
    // every tier bought at once - it's set to whichever cart tier (if
    // any) is the Top 10 one, since that's the most significant, else
    // the first item; the flags below are what's actually authoritative.
    let mergedFounding = vendor.is_founding_vendor;
    let mergedTop10 = vendor.is_top10;
    let mergedFeatured = vendor.is_featured;
    let representativeTierId = registrations[0].tier_id;
    let stripeFeeAllocated = 0;

    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      const tier = reg.pricing_tiers;
      if (!tier) continue;
      mergedFounding = mergedFounding || tier.is_founding;
      mergedTop10 = mergedTop10 || tier.is_top10;
      mergedFeatured = mergedFeatured || tier.is_top10;
      if (tier.is_top10) representativeTierId = reg.tier_id;

      // Proportional Stripe-fee split by item price; the last item
      // absorbs whatever rounding remainder is left so the parts sum
      // exactly to stripeFeeTotalCents.
      const isLast = i === registrations.length - 1;
      const shareCents = isLast
        ? stripeFeeTotalCents - stripeFeeAllocated
        : Math.round((stripeFeeTotalCents * reg.amount_cents) / itemsTotalCents);
      stripeFeeAllocated += shareCents;
      const platformShare = i === 0 ? PLATFORM_FEE_CENTS : 0;

      const regPatchRes = await sb(env, `/registrations?id=eq.${reg.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId,
          awarded_top10: tier.is_top10,
          stripe_fee_cents: shareCents,
          platform_fee_cents: platformShare,
          net_payout_cents: reg.amount_cents - shareCents - platformShare,
        }),
      });
      if (!regPatchRes.ok) throw new Error(`Cart registration update failed: ${await regPatchRes.text()}`);
    }

    const vendorPatchRes = await sb(env, `/vendors?id=eq.${vendorId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "active",
        approved_at: new Date().toISOString(),
        tier_id: representativeTierId,
        is_founding_vendor: mergedFounding,
        is_top10: mergedTop10,
        is_featured: mergedFeatured,
        category_tier: mergedTop10 ? "top_10" : vendor.category_tier,
      }),
    });
    if (!vendorPatchRes.ok) throw new Error(`Vendor update failed: ${await vendorPatchRes.text()}`);

    await sb(env, "/activity_log", {
      method: "POST",
      body: JSON.stringify({
        entity_type: "vendor",
        entity_id: vendorId,
        entity_name: vendor.business_name,
        action: "Stripe cart payment completed",
        detail: `${registrations.length} item${registrations.length === 1 ? "" : "s"} — session ${session.id}`,
      }),
    }).catch(() => {});

    return json({ received: true });
  } catch (err) {
    console.error("Cart webhook processing failed", err);
    return json({ error: "Processing failed." }, 500);
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const apiRoutes = [
      "/api/create-checkout-session",
      "/api/create-cart-checkout-session",
      "/api/stripe-webhook",
      "/api/log-terms-agreement",
      "/api/admin-create-business",
    ];
    if (!apiRoutes.includes(url.pathname) || request.method !== "POST") return env.ASSETS.fetch(request);

    // /api/log-terms-agreement and /api/admin-create-business only touch
    // Supabase, never Stripe - don't block them on Stripe secrets they
    // have no use for.
    const supabaseOnlyRoutes = ["/api/log-terms-agreement", "/api/admin-create-business"];
    const missing = supabaseOnlyRoutes.includes(url.pathname)
      ? missingEnvVars(env, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
      : missingEnvVars(env);
    if (missing.length > 0) {
      return json({ error: `Not configured yet - missing: ${missing.join(", ")}.` }, 503);
    }

    try {
      if (url.pathname === "/api/create-checkout-session") return await handleCreateCheckoutSession(request, env);
      if (url.pathname === "/api/create-cart-checkout-session") return await handleCreateCartCheckoutSession(request, env);
      if (url.pathname === "/api/log-terms-agreement") return await handleLogTermsAgreement(request, env);
      if (url.pathname === "/api/admin-create-business") return await handleAdminCreateBusiness(request, env);
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
