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

### v2 migration additions (`feature/v2-migration-and-lov`)

- **Admin Map/Board** (`/admin/board`): private, email-gated venue booth
  board. Tap a booth to cycle Open → Reserved → Occupied, with a gold ring
  marking "Top Booth" tier. This is a grid-based board today (not yet the
  full interactive SVG blueprint with perimeter/gate/exit markers — see
  Roadmap).
- **Month-to-month Event Calendar** (`/calendar`): flyer view — tap a day
  to see that day's event flyer(s), Instagram, and location.
- **Haversine "Near You" sorting**: vendors can set their location from the
  dashboard (`📍 Use My Current Location`), and `/vendors` has a "Sort Near
  Me" button that uses the browser's geolocation + a Haversine
  great-circle-distance calculation to sort every vendor card (including
  bulk-seeded LOV guest listings) by distance.
- **LOV bulk seeding**: `scripts/seed-lov.ts` + `seed/lov.example.json` —
  paste this month's vendor/event list into a JSON file and run one command
  to bulk-insert it (see below).

## Setup

1. **Supabase**
   - Create a project at [supabase.com](https://supabase.com).
   - In the SQL editor, run the files in `supabase/migrations/` **in
     order** (`0001_init.sql` → `0004_lov_booths_geo.sql`) — or use the
     Supabase CLI: `supabase db push`.
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

3. **Admin access**
   - Set `ADMIN_EMAILS` in `.env.local` to a comma-separated list of the
     Supabase Auth accounts (sign up the normal vendor way, or invite via
     the Supabase dashboard) that should be able to reach `/admin/board`.

4. **Run it**

   ```bash
   cp .env.example .env.local   # fill in the real values
   npm install
   npm run dev
   ```

## Seeding this month's LOV (List of Vendors & Events)

1. Edit `seed/lov.json` (already populated below) or start from
   `seed/lov.example.json`. Each row is:

   ```json
   {
     "type": "event",            // or "vendor"
     "name": "Downtown Night Market",
     "date": "2026-08-15",       // YYYY-MM-DD, or null for something with no single fixed date
     "recurrence": null,         // e.g. "Wednesdays, 9am-1:30pm (May-Nov)" for a weekly market
     "location": "Plaza de Cesar Chavez, San Jose, CA",
     "instagram_handle": "@citypinned",
     "category": "Food Truck",   // matched case-insensitively; created if new
     "booth_tier": "top",        // or "regular"
     "flyer_image_url": "https://…",  // event flyers only
     "website_url": "https://…"       // organizer/vendor-directory link
   }
   ```

2. Run:

   ```bash
   npm run seed:lov -- seed/lov.json
   ```

   Categories are created automatically if they don't exist yet. Rows are
   matched/updated by `(type, name, date)` — or by `(type, name)` alone for
   recurring rows with no date (e.g. a weekly farmers market) — so
   re-running the script is safe.

   Seeded `event` rows show up on `/calendar` (dated ones on their day,
   recurring ones in the "Recurring Markets & Events" list below the
   grid); seeded `vendor` rows show up on `/vendors` as "Guest Listing"
   cards alongside full paid vendor
   accounts.

`seed/lov.json` currently has the first real batch: 6 San Jose-area
recurring farmers markets/art walk (Downtown SJ, First Friday Art Walk,
Japantown, Santana Row, Santa Clara Valley Medical Center, Downtown
Campbell) plus their 37 named vendors, deduped where a vendor appears at
more than one market. None of these have `lat`/`lng` or Instagram handles
yet (not in the source list) — add them as you get them so "Near You"
sorting picks these up too.

## Roadmap (not yet built — tracked for the next iterations)

- Full interactive SVG venue blueprint (the `/admin/board` grid is the
  interim version): booth pin placement, perimeter/gate/exit/restroom
  markers.
- Post-event teardown: "Event Ended" overlay + archived, searchable
  "Zone Book" of past layouts.
- Home Cooks notice board (card-deck view for micro-food creators).
- "Add to Calendar" (Google/Apple) + social share buttons, sticky day
  headers, and quick-filter pills (All/Today/Weekend/Food) on the calendar.
- Admin staging sandbox: queue/batch-approve flyers with auto-publish
  timers, plus automatic flyer image compression.

The database schema already leaves room for these (`booths.x`/`y` for
future SVG coordinates, `lov_entries` for the zone book archive) so they
can build on top of this migration rather than requiring another rewrite.

## Legacy references

`https://armanib5.github.io/Beta.V2/` and
`https://armanib5.github.io/Map.board/board/index.html` are read-only
skeleton/reference archives from earlier iterations — used here only for
UI/UX inspiration (the Map.board venue-board legend and admin-gating
pattern informed `/admin/board`). Nothing in this repo touches those
sites or any `main`/production branch.
