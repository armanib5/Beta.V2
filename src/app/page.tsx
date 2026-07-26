"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
            Local vendors, home cooks &amp; artisans — find your spot.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
            Lock in a permanent CityPinned vendor profile as a Founding Vendor. Early-bird
            pricing, a badge that carries into Version 3, and a dashboard you control from your
            phone.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Secure your permanent vendor account
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
            One-time payment via Stripe. Pay online, or hand your phone/iPad to a vendor at your
            next event and let them scan a QR code to pay in person.
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
