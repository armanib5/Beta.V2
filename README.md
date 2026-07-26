# CityPinned v2.0

A fresh, from-scratch rebuild of CityPinned: local vendors, home cooks, and
artisans get a **permanent** account, a Stripe-powered early-bird lock-in
payment, and a self-service dashboard for their profile and photos.

**Stack (V2, current): Next.js static export (`output: 'export'`) + Tailwind
CSS, hosted free on GitHub Pages, talking directly to Supabase (Postgres +
Auth + Storage) from the browser with the public anon key.** There is no
backend server, no API routes, and no secret keys in the deployed app —
every write is authorized by Postgres Row Level Security. See
[V2 → V3 upgrade path](#v2--v3-upgrade-path) below for when that changes.

## V1 (BayPinned SJ) is ported in, live, unmodified

`public/board/`, `public/map/`, `public/pins/`, `public/admin/`, and
`public/shared/` are the **actual files** from the `armanib5/map.board`
repo, copied over as-is (not rewritten in React) and served as plain
static pages alongside the Next app — `/board/`, `/map/`, `/pins/`,
`/admin/`. This preserves V1's exact behavior with zero risk of a
React-port bug in things like the SVG map math or the promo-booking
calendar logic, and matches how V1's own root page already worked
("each still runs standalone from its own folder").

- **They keep talking to V1's own, separate, already-live Supabase
  project** (`public/shared/supabase-config.js`, unchanged — its anon key
  is meant to be public, exactly like V2's). This app intentionally runs
  on **two separate Supabase projects**: V1's (board/map/pins/admin, its
  own schema — see `armanib5/map.board`'s `supabase/schema.sql`) and V2's
  (this repo's `supabase/migrations/`, the new paid vendor-account system).
  They don't share tables or an `admins` list.
- The only edits made to V1's files: a "🔒 Vendor Login" link added to the
  board's nav (bridges to V2's new paid account system at `/vendor/login/`)
  and V2's home page now has a section linking out to `/board/`, `/map/`,
  and `/pins/`. Everything else — styling, the SVG downtown map, the
  Leaflet map, flyers, category filters, the free device-local "My
  Dashboard"/`?admin=1` admin — is byte-for-byte what shipped in V1.
- `/admin/` (V1's own, Supabase-Auth-gated) and `/admin/board/` (V2's new,
  `admins`-table-gated booth board) are two different admin surfaces on
  two different backends — that's intentional, not a bug, per the "keep
  two separate Supabase projects" decision above.

## What's built

- **Database schema** (`supabase/migrations/`): vendors, categories,
  vendor↔category tags, pricing tiers, LOV listings (`lov_entries`),
  venue booths, and vendor photos — all protected by Row Level Security.
  An `admins` table + a Postgres trigger (`protect_vendor_privileged_fields`)
  are the actual security boundary now that there's no backend: a vendor
  can freely edit their own profile, but can **not** grant themselves
  `active` status or a Founding Vendor / Top 10 badge — only a signed-in
  admin session can flip those fields.
- **Stripe monetization via static Payment Links**: each pricing tier has a
  `stripe_payment_link` (created once in the Stripe Dashboard, no backend
  involved). The pricing card links straight to it and can render it as a
  **QR code** for in-person phone/iPad checkout at an event.
- **Vendor accounts**: self-serve signup creates the vendor's own row
  (status `pending`) directly from the browser. You (the admin) approve it
  — checking Stripe for the matching payment — from `/admin/board`'s
  vendor logic or directly in the Supabase table editor, which flips
  `status` to `active` and sets the Founding Vendor / Top 10 badges.
- **Self-service vendor dashboard** (`/vendor/dashboard`): edit business
  info, upload a logo and photo gallery (stored permanently in Supabase
  Storage), toggle category tags, and set location (for "Near You" sorting)
  — usable immediately, even while `pending`.
- **Public vendor profile** (`/vendor?slug=...`) and a **Vendor Directory**
  (`/vendors`) grid, both fetched client-side so new vendors show up
  without a rebuild.
- **Admin Map/Board** (`/admin/board`): tap a booth to cycle Open → Reserved
  → Occupied. Gated by the `admins` table, not just a hidden URL — every
  write re-checks admin membership at the database layer.
- **Month-to-month Event Calendar** (`/calendar`): flyer view, multi-day
  event ranges, and a "Recurring Markets & Events" list for weekly/monthly
  series with no single date.
- **Haversine "Near You" sorting** on `/vendors` using the browser's
  geolocation.
- **LOV bulk seeding** (`scripts/seed-lov.ts`) and **geocoding**
  (`scripts/geocode-lov.ts`) — local dev-only scripts using the
  service-role key, never shipped to the browser.

## Setup

1. **Supabase**
   - Create a project at [supabase.com](https://supabase.com).
   - In the SQL editor, run every file in `supabase/migrations/` **in
     order** (`0001_init.sql` → `0007_static_export_rls_hardening.sql`) —
     or use the Supabase CLI: `supabase db push`.
   - Under **Authentication → Providers → Email**, turn **off** "Confirm
     email" so a vendor gets a session immediately after signing up.
   - Make yourself an admin (run once, in the SQL editor, after you've
     signed up your own account through the site):
     ```sql
     insert into public.admins (id)
     select id from auth.users where email = 'you@example.com';
     ```
   - Copy your Project URL and **anon key** (not the service-role key) into
     `.env.local` — see `.env.example`. The anon key is safe to ship to the
     browser; RLS is what protects the data.

2. **Stripe — Payment Links (no backend)**
   - In the Stripe Dashboard, create a Payment Link for each tier ($50
     Founding Vendor, $100 Top 10 Category — or whatever you set).
   - Set each Payment Link's "After payment" redirect to
     `https://armanib5.github.io/Beta.V2/register/confirmation/`.
   - Paste the resulting URLs into `pricing_tiers.stripe_payment_link` for
     the matching row (Supabase table editor, or `update public.pricing_tiers
     set stripe_payment_link = '...' where slug = 'founding-vendor';`).
   - Adjust the `$50`/`$100` price points in the `pricing_tiers` table to
     taste. There's no webhook — payment confirmation is manual for now
     (see the V3 section for when that changes).

3. **Run it locally**

   ```bash
   cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
   npm install
   npm run dev
   ```

4. **Build & preview the static export**

   ```bash
   npm run build     # writes the static site to out/
   npm run preview   # serves out/ locally so you can click through it
   ```

## Deploying to GitHub Pages

This repo is set up to deploy but **is not wired to `main` yet** — per the
current branch strategy, everything lives on a feature branch until you're
ready. When you are:

1. Merge this branch into `main`.
2. In the repo's **Settings → Pages**, set **Source** to "GitHub Actions".
3. Add two repo secrets (**Settings → Secrets and variables → Actions**):
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. `.github/workflows/deploy-pages.yml` (already in this repo) builds and
   deploys `out/` automatically on every push to `main` from then on.

The site's `basePath`/`assetPrefix` come from `BASE_PATH` in
`src/lib/site.ts` (imported by `next.config.ts`), hardcoded to `/Beta.V2`
to match `https://armanib5.github.io/Beta.V2/`. Update that one constant
if the repo is ever renamed — it's also what any plain `<a href>` to the
ported V1 pages (`/board/`, `/map/`, `/pins/`, `/admin/`) needs prefixed
with by hand, since those are static files outside the Next app and don't
get `next/link`'s automatic basePath handling.

## Seeding this month's LOV (List of Vendors & Events)

1. Edit `seed/lov.json` (already populated below) or start from
   `seed/lov.example.json`. Each row is:

   ```json
   {
     "type": "event",            // or "vendor"
     "name": "Downtown Night Market",
     "date": "2026-08-15",       // YYYY-MM-DD, or null for something with no single fixed date
     "end_date": null,           // set for multi-day events (e.g. a 5-day fair); must be >= date
     "recurrence": null,         // e.g. "Wednesdays, 9am-1:30pm (May-Nov)" for a weekly market
     "location": "Plaza de Cesar Chavez, San Jose, CA",
     "instagram_handle": "@citypinned",
     "category": "Food Truck",   // matched case-insensitively; created if new
     "booth_tier": "top",        // or "regular"
     "flyer_image_url": "https://…",  // event flyers only
     "website_url": "https://…"       // organizer/vendor-directory link
   }
   ```

2. Run (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` — this key never
   ships to the browser, it's only used by this local script):

   ```bash
   npm run seed:lov -- seed/lov.json
   ```

   Categories are created automatically if they don't exist yet. Rows are
   matched/updated by `(type, name, date)` — or by `(type, name)` alone for
   recurring rows with no date (e.g. a weekly farmers market) — so
   re-running the script is safe.

   Seeded `event` rows show up on `/calendar`; seeded `vendor` rows show up
   on `/vendors` as "Guest Listing" cards alongside full paid vendor
   accounts.

3. Geocode every row so it can be sorted/placed on a map (also
   service-role, local-only):

   ```bash
   npm run geocode:lov -- seed/lov.json
   ```

   Geocodes each row's `location` through Nominatim (OpenStreetMap, no API
   key), only falling back to a central-San-Jose coordinate (37.3382,
   -121.8863) if a real address genuinely can't be resolved. Safe to
   re-run any time you add rows with new locations.

`seed/lov.json` currently has 6 San Jose-area recurring farmers
markets/art walk plus their 37 named vendors, and 12 August 2026
San Jose-area events (4 multi-day). All 55 rows are geocoded.

## V2 → V3 upgrade path

V2 (this branch, right now) is deliberately simple: static export, free
hosting, anon-key + RLS, Stripe Payment Links, manual payment
confirmation. When it's time for real-time booth reservations, automatic
Stripe-webhook-driven account activation, and dynamic subscription
billing:

| | V2 (now) | V3 (future) |
|---|---|---|
| Hosting | GitHub Pages (`output: 'export'`) | Vercel (native Next.js) |
| Database | Client-side Supabase, anon key + RLS | Same Supabase project (or a new one), + server-side service-role routes for privileged writes |
| Payments | Stripe Payment Links / QR codes, manual approval | Stripe Checkout + webhooks, automatic activation |
| Branch strategy | Feature branch; `main`/Pages untouched | Merge to a `feature/v3-platform-launch` branch, deploy that to Vercel; keep `main`/Pages as the always-on fallback |

When you're ready, tell Claude Code to start the V3 branch — the plan is:
keep this GitHub Pages site live as a fallback, branch again, point Vercel
at the new branch (Vercel deploys don't touch GitHub Pages), and
reintroduce the server-side pieces this migration removed (`/api/stripe/webhook`,
service-role vendor claim, etc.) — the schema (`registrations` table,
`stripe_checkout_session_id`, `awarded_top10`) was left in place
specifically so that transition doesn't require another rewrite.

## Roadmap (not yet built)

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

## Legacy references

`https://armanib5.github.io/Beta.V2/` and
`https://armanib5.github.io/Map.board/board/index.html` are read-only
skeleton/reference archives from earlier iterations — used here only for
UI/UX inspiration (the Map.board venue-board legend and admin-gating
pattern informed `/admin/board`). This repo's `main` branch has not been
touched by this work.
