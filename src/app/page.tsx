"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BASE_PATH } from "@/lib/site";
import type { Category, PricingTier } from "@/lib/types";
import { PricingCard } from "@/components/pricing-card";

export default function HomePage() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("pricing_tiers")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .returns<PricingTier[]>()
      .then(({ data }) => setTiers(data ?? []));
    supabase
      .from("categories")
      .select("*")
      .order("sort_order")
      .returns<Category[]>()
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  return (
    <div>
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
            CityPinned Version 2.0
          </p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-5xl">
            Discover what&rsquo;s happening in your city — and what&rsquo;s pinned around it.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
            CityPinned is a free, live guide to Bay Area downtowns — browse the events calendar,
            explore the map for local businesses and vendors, and check the full city directory.
            Whether you live here or you&rsquo;re just visiting, it&rsquo;s the fastest way to find
            what&rsquo;s going on and who&rsquo;s around you. Own a business? Claim your free listing
            below and get pinned yourself.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/vendor/signup"
              className="w-full rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 sm:w-auto"
            >
              Create Free Listing
            </Link>
            <a
              href="#pricing"
              className="w-full rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300 sm:w-auto"
            >
              Become a Founding Vendor
            </a>
            <Link
              href="/vendors"
              className="w-full rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto"
            >
              Browse the Vendor Directory
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-amber-50 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">
              📌 BayPinned
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              The live board &amp; map for Bay Area downtowns
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
              Everything happening near you, in one place: browse the Board for flyers and
              markets, the Map for local businesses and vendors, and the calendar for what&rsquo;s
              coming up — plus Top 10 bites, sips, and events. Free for everyone, no account
              needed, whether you&rsquo;re local or just passing through.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <a
              href={`${BASE_PATH}/board/`}
              className="rounded-2xl border border-amber-200 bg-white p-5 text-center shadow-sm hover:shadow-md"
            >
              <p className="text-2xl">🗒️</p>
              <p className="mt-2 font-bold text-slate-900">The Board</p>
              <p className="mt-1 text-sm text-slate-600">Flyers, markets &amp; the Vendor Hub</p>
            </a>
            <a
              href={`${BASE_PATH}/map/`}
              className="rounded-2xl border border-amber-200 bg-white p-5 text-center shadow-sm hover:shadow-md"
            >
              <p className="text-2xl">🗺️</p>
              <p className="mt-2 font-bold text-slate-900">The Map</p>
              <p className="mt-1 text-sm text-slate-600">Interactive downtown map with live pins</p>
            </a>
            <a
              href={`${BASE_PATH}/pins/`}
              className="rounded-2xl border border-amber-200 bg-white p-5 text-center shadow-sm hover:shadow-md"
            >
              <p className="text-2xl">📍</p>
              <p className="mt-2 font-bold text-slate-900">Manage My Pin</p>
              <p className="mt-1 text-sm text-slate-600">Vendors: log in to place your business exactly on the map</p>
            </a>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Optional paid upgrades
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
            Your CityPinned listing and flyer are free —{" "}
            <Link href="/vendor/signup" className="font-semibold text-slate-900 underline">
              create your free listing here
            </Link>
            . The tiers below are optional: one-time payment via Stripe for extra visibility
            (a Founding Vendor badge, Top 10 placement). Pay online, or hand your phone/iPad to
            a vendor at your next event and let them scan a QR code to pay in person.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {tiers.map((tier) => (
            <PricingCard key={tier.id} tier={tier} />
          ))}
          {!tiers.length && (
            <p className="col-span-2 text-center text-sm text-slate-500">
              Pricing tiers are being set up — check back soon.
            </p>
          )}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-slate-600">
          Please note: CityPinned and its sister city networks (including BayPinned) are
          interactive advertising directories and do not host, process, or hold funds for any
          transactions. Payments are processed directly by Stripe. CityPinned and its sister city
          networks cannot issue refunds, reverse transactions, or resolve financial disputes
          between parties. For payment issues, please contact Stripe or your financial
          institution directly.
        </p>
      </section>

      <section className="border-t border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Every kind of local vendor, welcome
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <span
                key={category.id}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
              >
                <span aria-hidden="true">{category.icon}</span>
                {category.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-100 py-14">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Already paid? Set up your permanent account
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Every Founding Vendor gets a login to manage their own profile, logo, photos, and
            category tags — no need to send us your details by hand.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/vendor/signup"
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Create My Vendor Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
