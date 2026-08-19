"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { BrandAssets } from "@/lib/brand-assets";
import type { Category, PricingTier } from "@/lib/types";
import { BASE_PATH } from "@/lib/site";
import { PricingCard } from "@/components/pricing-card";
import { BrandProvider, Pin } from "@/components/brand/brand-context";
import { CategoryStrip } from "@/components/home/category-strip";
import { CitySearch } from "@/components/home/city-search";
import { CitySkyline } from "@/components/home/skyline";
import { FeatureCards } from "@/components/home/feature-cards";
import { HomeFooter, UtilityRow } from "@/components/home/home-footer";
import { HomeHeader } from "@/components/home/home-header";
import { HomeMenu } from "@/components/home/home-menu";
import {
  IconArrowRight,
  IconGift,
  IconLayers,
  IconMapPin,
  IconPeople,
  IconSparkle,
} from "@/components/home/icons";

function Benefit({ icon, title, lines }: { icon: ReactNode; title: string; lines: string[] }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="cp-chrome-text text-[13px] font-bold leading-tight">{title}</p>
        {lines.map((line) => (
          <p key={line} className="text-[11px] leading-tight text-slate-400">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * The CityPinned Home Screen.
 *
 * Data comes from the same Supabase queries the page has always run
 * (pricing tiers, categories, auth session); every destination is an
 * existing route. Brand artwork is resolved at build time and handed in
 * by the page — see src/lib/brand-assets.ts.
 */
export function HomeScreen({ brandAssets }: { brandAssets: BrandAssets }) {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

    supabase.auth.getUser().then(({ data }) => setIsSignedIn(Boolean(data.user)));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrandProvider assets={brandAssets}>
      <div className="cp-screen min-h-screen">
        <HomeHeader
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((prev) => !prev)}
          onOpenMenu={() => setMenuOpen(true)}
        />

        {/* ------------------------------------------------------------ HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            {/* Downtown San Jose at night — the city this beta is live in. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BASE_PATH}/board/img/background.jpg`}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              style={{ filter: "grayscale(1) brightness(0.5) contrast(1.3)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-[#030304]" />
            <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_22%_38%,rgba(255,255,255,0.14),transparent_70%)]" />
          </div>

          <div className="relative mx-auto w-full max-w-[560px] px-3 pb-6 pt-5 sm:max-w-3xl sm:px-6 lg:max-w-6xl">
            <div className="flex items-start gap-3 sm:gap-6">
              <Pin
                className="h-44 w-auto shrink-0 drop-shadow-[0_14px_28px_rgba(0,0,0,0.9)] sm:h-64 lg:h-[19rem]"
                title="CityPinned Ultimate Pin"
              />
              <div className="min-w-0 pt-2">
                <h1 className="text-[26px] font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-5xl">
                  See local flyers,
                  <br />
                  events, <span className="text-slate-400">businesses</span>
                  <br />
                  and <span className="text-slate-400">places</span> in one city.
                </h1>
                <p className="mt-3 text-[14px] text-slate-300 sm:text-lg">
                  Free to browse. No account needed.
                </p>
                <p className="cp-glass mt-4 inline-flex max-w-full items-center px-3 py-2 sm:px-5 sm:py-2.5">
                  <span className="cp-content flex items-center gap-2">
                    <IconSparkle className="h-3.5 w-3.5 shrink-0 text-slate-100" />
                    <span className="cp-chrome-text font-mono text-[10px] font-bold uppercase tracking-[0.12em] sm:text-sm">
                      One city. One flyer. One pin. One you.
                    </span>
                    <IconSparkle className="h-3.5 w-3.5 shrink-0 text-slate-100" />
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5 sm:mx-auto sm:mt-8 sm:max-w-xl">
              <CitySearch />
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[560px] px-3 sm:max-w-3xl sm:px-6 lg:max-w-6xl">
          {/* ------------------------------------------------ FEATURE CARDS */}
          <section className="pt-5" aria-label="Explore CityPinned">
            <FeatureCards />
          </section>

          {/* ---------------------------------------------------- CATEGORIES */}
          <div className="pt-7">
            <CategoryStrip categories={categories} />
          </div>

          {/* ----------------------------------------------- FREE EXPLORATION */}
          <section className="pt-5">
            <div className="cp-glass p-4 sm:p-5">
              <div className="cp-content flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-start gap-3">
                  <IconGift className="mt-0.5 h-7 w-7 shrink-0 text-slate-100" />
                  <div>
                    <p className="cp-chrome-text text-[15px] font-bold leading-snug sm:text-lg">
                      Explore CityPinned for FREE. No account needed.
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-slate-400 sm:text-sm">
                      Listing is always free. Explore more paid promotions for extra visibility.
                    </p>
                  </div>
                </div>
                <a
                  href="#pricing"
                  className="cp-btn cp-press flex items-center justify-center px-5 py-3 sm:shrink-0"
                >
                  <span className="cp-content flex items-center gap-2">
                    <span className="cp-chrome-text text-sm font-bold">Look at Options</span>
                    <IconArrowRight className="h-4 w-4 text-slate-200" />
                  </span>
                </a>
              </div>
            </div>
          </section>

          {/* --------------------------------------------------- FOUR BENEFITS */}
          <section className="pt-3" aria-label="Why CityPinned">
            <div className="cp-glass p-1.5">
              <div className="cp-content grid grid-cols-2 divide-white/10 sm:grid-cols-4 sm:divide-x">
                <Benefit
                  icon={<IconGift className="h-6 w-6 text-slate-100" />}
                  title="100% Free"
                  lines={["No account", "needed to browse."]}
                />
                <Benefit
                  icon={<IconMapPin className="h-6 w-6 text-slate-100" />}
                  title="Live Pins"
                  lines={["Events, vendors &", "places updated constantly."]}
                />
                <Benefit
                  icon={<IconLayers className="h-6 w-6 text-slate-100" />}
                  title="All in One"
                  lines={["Board, Map &", "Directory in one place."]}
                />
                <Benefit
                  icon={<IconPeople className="h-6 w-6 text-slate-100" />}
                  title="For Everyone"
                  lines={["Locals &", "visitors welcome."]}
                />
              </div>
            </div>
          </section>

          {/* ----------------------------------------------------- PRICING */}
          <section id="pricing" className="scroll-mt-[180px] pt-8 sm:scroll-mt-[200px]">
            <div className="text-center">
              <h2 className="cp-chrome-text text-xl font-extrabold sm:text-3xl">
                Secure your permanent vendor account
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-[13px] text-slate-400 sm:text-sm">
                One-time payment via Stripe. Pay online, or hand your phone/iPad to a vendor at
                your next event and let them scan a QR code to pay in person.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-5">
              {tiers.map((tier) => (
                <PricingCard key={tier.id} tier={tier} tone="dark" />
              ))}
              {!tiers.length && (
                <p className="cp-glass px-4 py-5 text-center text-sm text-slate-400 sm:col-span-2">
                  <span className="cp-content">
                    Pricing tiers are being set up — check back soon.
                  </span>
                </p>
              )}
            </div>
          </section>

          {/* --------------------------------------------------- VENDOR CTA */}
          <section className="pt-8">
            <div className="cp-glass relative overflow-hidden p-4 sm:p-6">
              <div className="cp-art">
                <CitySkyline className="absolute inset-y-0 right-0 h-full w-[88%]" seed={23} />
                <div className="absolute inset-0 bg-gradient-to-r from-[#030304] via-[#030304]/85 to-transparent" />
              </div>
              <div className="cp-content flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[19px] font-extrabold leading-snug text-white sm:text-3xl">
                    Your city. Your events.
                    <br />
                    Your people. <em className="italic text-slate-300">All pinned.</em>
                  </p>
                  <Link
                    href="/vendor/signup"
                    className="cp-btn cp-press mt-4 inline-flex items-center px-6 py-3"
                  >
                    <span className="cp-content flex items-center gap-2">
                      <span className="cp-chrome-text text-sm font-bold">Join as a Vendor</span>
                      <IconArrowRight className="h-4 w-4 text-slate-200" />
                    </span>
                  </Link>
                </div>
                <Pin className="h-24 w-auto shrink-0 sm:h-36" decorative />
              </div>
            </div>
          </section>

          {/* ------------------------------------------------- UTILITY STRIP */}
          <section className="pt-4" aria-label="More from CityPinned">
            <UtilityRow />
          </section>
        </div>

        <HomeFooter isSignedIn={isSignedIn} onOpenMenu={() => setMenuOpen(true)} />

        <HomeMenu open={menuOpen} onClose={() => setMenuOpen(false)} isSignedIn={isSignedIn} />
      </div>
    </BrandProvider>
  );
}
