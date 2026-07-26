# CityPinned v2.0

A fresh, from-scratch rebuild of CityPinned: local vendors, home cooks, and
artisans get a **permanent** account, a Stripe-powered early-bird lock-in
payment, and a self-service dashboard for their profile and photos.

Stack: **Next.js (App Router, TypeScript) + Tailwind CSS + Supabase
(Postgres, Auth, Storage) + Stripe**.

## What's built in this foundation

- **Database schema** (`supabase/migrations/`): vendors, categories,
  vendor↔category tags, pricing tiers, registrations (payments), and
  vendor photos — with Row Level Security so vendors can only ever edit
  their own data, and an atomic slot-claim function so the scarce "Top 10"
  spots can't be double-granted under concurrent payments.
- **Stripe monetization**: pre-order tier checkout (`/api/stripe/checkout`),
  a webhook (`/api/stripe/webhook`) that marks payment complete and grants
  Founding Vendor / Top 10 Category badges, and an in-person **QR code**
  flow so you can take payment on your phone/iPad at an event.
- **Instant digital receipt**: `/register/confirmation` — the
  "Registration Confirmed — Permanent Account Secured" screen a vendor
  lands on right after paying.
- **Vendor accounts**: signup (tied to a paid registration by email),
  login, and a **permanent** account that survives independent of any
  single event.
- **Self-service vendor dashboard** (`/vendor/dashboard`): edit business
  info, upload a logo and photo gallery (stored permanently in Supabase
  Storage — no more losing images on a transfer), and toggle category tags.
- **Public vendor profile** (`/vendor/[slug]`) and a **Vendor Directory**
  (`/vendors`) grid that works on any screen size with no map dependency.
- Mobile-first UI throughout (Tailwind, responsive nav, touch-friendly
  forms).

## Setup

1. **Supabase**
   - Create a project at [supabase.com](https://supabase.com).
   - In the SQL editor, run the files in `supabase/migrations/` in order
     (`0001_init.sql`, `0002_rls_and_storage.sql`, `0003_seed.sql`) — or
     use the Supabase CLI: `supabase db push`.
   - Under **Authentication → Providers → Email**, turn **off** "Confirm
     email" for now so a vendor gets a session immediately after signing
     up and can be linked to their paid registration in one step. (A
     proper email-verification flow is a good v2.1 follow-up.)
   - Copy your Project URL, anon key, and service_role key into `.env.local`
     (see `.env.example`).

2. **Stripe**
   - Copy your secret key into `STRIPE_SECRET_KEY`.
   - Create a webhook endpoint pointing at
     `https://<your-domain>/api/stripe/webhook` listening for
     `checkout.session.completed`, and put its signing secret in
     `STRIPE_WEBHOOK_SECRET`. For local dev: `stripe listen --forward-to
     localhost:3000/api/stripe/webhook`.
   - Adjust the `$50` / `$100` price points in
     `supabase/migrations/0003_seed.sql` (or directly in the
     `pricing_tiers` table) to taste.

3. **Run it**

   ```bash
   cp .env.example .env.local   # fill in the real values
   npm install
   npm run dev
   ```

## Roadmap (not yet built — tracked for the next iterations)

The rest of the v2.0 vision this foundation is designed to grow into,
prioritized how they were requested:

- Interactive SVG venue map: booth claiming, premium "Top Booth" pin
  tiers, perimeter/gate/exit/restroom markers.
- Post-event teardown: "Event Ended" overlay + archived, searchable
  "Zone Book" of past layouts.
- Admin booth toggle (private, mobile-friendly "Occupied/Reserved" tap
  target).
- "Near You" geolocation sorting (Haversine) on the vendor directory.
- Home Cooks notice board (card-deck view for micro-food creators).
- Month-to-month event calendar with digital flyers, "Add to
  Calendar"/social share, and sticky day headers + quick-filter pills.
- Admin staging sandbox: queue/batch-approve flyers with auto-publish
  timers, plus automatic flyer image compression.

The database schema already leaves room for these (e.g. `vendors.tier_id`,
`is_top10`/`is_founding_vendor` flags, and the photo/category tables are
reusable as-is); booths, events, and the zone book will get their own
migrations when that phase starts.
