"use client";

import { CityPinnedWordmark } from "@/components/brand/wordmark";
import { UltimatePin } from "@/components/brand/ultimate-pin";
import { CpLink } from "@/components/home/cp-link";
import { primaryNav } from "@/lib/home-nav";
import {
  IconDots,
  IconHandshake,
  IconMapPin,
  IconPushPin,
  IconStorefront,
} from "@/components/home/icons";

const navIcons = [IconPushPin, IconMapPin, IconStorefront, IconHandshake, IconDots];

export function HomeHeader({
  menuOpen,
  onToggleMenu,
  onOpenMenu,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-[#050506]/92 pb-2 pt-3 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[560px] px-3 sm:max-w-3xl sm:px-5 lg:max-w-6xl">
        {/* Brand lockup */}
        <div className="flex items-center gap-2 sm:gap-4">
          <UltimatePin className="h-12 w-auto shrink-0 sm:h-14" title="CityPinned" glow />
          <div className="min-w-0 flex-1">
            <CityPinnedWordmark className="w-full max-w-[300px] text-[clamp(28px,9vw,54px)] sm:max-w-[380px]" />
          </div>
          <button
            type="button"
            onClick={onToggleMenu}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="cp-more-menu"
            className="cp-glass cp-press flex h-12 w-12 shrink-0 items-center justify-center sm:h-14 sm:w-14"
            style={{ borderRadius: 16 }}
          >
            <span className="cp-content flex flex-col gap-[5px]" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block h-[2px] w-6 rounded-full bg-gradient-to-r from-white via-slate-300 to-slate-500"
                />
              ))}
            </span>
          </button>
        </div>

        {/* Primary navigation — four destinations + the "More" opener */}
        <nav aria-label="Primary" className="mt-3">
          <ul className="grid grid-cols-5 gap-1.5 sm:gap-3">
            {primaryNav.map((item, i) => {
              const NavIcon = navIcons[i];
              return (
                <li key={item.label} className="min-w-0">
                  <CpLink
                    to={item.to}
                    onAction={onOpenMenu}
                    className="cp-glass cp-press flex h-full w-full flex-col items-center justify-start gap-1 px-1 py-2.5 text-center sm:px-2 sm:py-3"
                  >
                    <span className="cp-content flex flex-col items-center gap-1">
                      <NavIcon className="h-5 w-5 text-slate-200 sm:h-6 sm:w-6" />
                      <span className="cp-chrome-text text-[11px] font-semibold leading-tight sm:text-sm">
                        {item.label}
                      </span>
                      {item.caption && (
                        <span className="hidden text-[9px] leading-tight text-slate-400 min-[390px]:block sm:text-[11px]">
                          {item.caption}
                        </span>
                      )}
                    </span>
                  </CpLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
