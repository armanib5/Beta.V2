"use client";

import type { ReactNode } from "react";
import { CpLink } from "@/components/home/cp-link";
import { BoothArt, CorkboardArt, MapArt } from "@/components/home/feature-art";
import { IconArrowRight, IconCompass, IconMapPin, IconPlus } from "@/components/home/icons";
import { ADD_PIN_URL, CORKBOARD_URL, MAP_URL, route, staticPage } from "@/lib/home-nav";
import type { CpDestination } from "@/lib/home-nav";

function FeatureCard({
  eyebrow,
  title,
  icon,
  copy,
  art,
  cta,
  to,
  extra,
}: {
  eyebrow?: string;
  title: string;
  icon?: ReactNode;
  copy: string[];
  art: ReactNode;
  cta: string;
  to: CpDestination;
  extra?: ReactNode;
}) {
  return (
    <article className="cp-glass flex flex-col p-3 sm:p-4">
      <div className="cp-content flex h-full flex-col">
        <header className="flex items-start gap-2.5">
          {icon && (
            <span className="cp-matte-panel flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <span className="cp-content">{icon}</span>
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-medium leading-tight text-slate-300 sm:text-[10px] lg:text-xs">
                {eyebrow}
              </p>
            )}
            <h3 className="cp-chrome-text break-words text-xl font-extrabold uppercase leading-tight tracking-tight sm:text-[15px] md:text-lg lg:text-2xl">
              {title}
            </h3>
          </div>
        </header>

        <div className="mt-1.5 space-y-0.5">
          {copy.map((line) => (
            <p key={line} className="text-[12px] leading-snug text-slate-400 sm:text-[13px]">
              {line}
            </p>
          ))}
        </div>

        <div className="cp-matte-panel relative mt-3 min-h-[150px] flex-1 overflow-hidden sm:min-h-[175px]">
          {art}
        </div>

        <div className="mt-3">
          <CpLink
            to={to}
            className="cp-btn cp-press flex w-full items-center justify-center px-4 py-2.5"
          >
            <span className="cp-content flex items-center gap-2">
              <span className="cp-chrome-text text-sm font-bold">{cta}</span>
              <IconArrowRight className="h-4 w-4 text-slate-200" />
            </span>
          </CpLink>
          {extra}
        </div>
      </div>
    </article>
  );
}

export function FeatureCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      <FeatureCard
        eyebrow="Event Flyers & More"
        title="Corkboard"
        icon={<IconMapPin className="h-5 w-5 text-slate-100" />}
        copy={["Different boards for every flyer.", "Each city. Easy to find."]}
        art={<CorkboardArt />}
        cta="Digital Flyers"
        to={staticPage(CORKBOARD_URL)}
      />

      <FeatureCard
        title="Map"
        copy={["All in one place."]}
        art={<MapArt />}
        cta="Open to Locate"
        to={staticPage(MAP_URL)}
        extra={
          <a
            href={ADD_PIN_URL}
            className="cp-press cp-focus mt-2 flex items-center justify-center gap-1.5 rounded-full py-1 text-[12px] font-semibold text-slate-300 hover:text-white"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Add a Pin
          </a>
        }
      />

      <FeatureCard
        eyebrow="Local"
        title="Businesses"
        icon={<IconCompass className="h-5 w-5 text-slate-100" />}
        copy={["Show near me", "local happenings."]}
        art={<BoothArt />}
        cta="Main Directory"
        to={route("/vendors")}
      />
    </div>
  );
}
