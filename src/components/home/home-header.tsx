"use client";

import { Pin, WordMark } from "@/components/brand/brand-context";
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

/**
 * Home Screen header: the CityPinned brand lockup with the hamburger, and
 * the five quick navigation choices beneath it. Every choice points at an
 * existing destination; "More" opens the menu panel.
 */
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
    <header className="sticky top-0 z-40 bg-[#030304]/94 pb-2.5 pt-3 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[560px] px-3 sm:max-w-3xl sm:px-6 lg:max-w-6xl">
        <div className="flex items-center gap-2 sm:gap-4">
          <Pin className="h-14 w-auto shrink-0 sm:h-16" title="CityPinned" />
          <div className="min-w-0 flex-1">
            <WordMark className="w-full max-w-[290px] text-[clamp(30px,9.5vw,56px)] sm:max-w-[380px]" />
          </div>
          <button
            type="button"
            onClick={onToggleMenu}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="cp-menu-panel"
            className="cp-glass cp-press flex h-12 w-12 shrink-0 items-center justify-center sm:h-14 sm:w-14"
            style={{ borderRadius: 16 }}
          >
            <span className="cp-content flex flex-col gap-[5px]" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block h-[2.5px] w-6 rounded-full"
                  style={{
                    background: "linear-gradient(90deg,#ffffff,#c9ced5 40%,#7d848c)",
                    boxShadow: "0 1px 1px rgba(0,0,0,0.8)",
                  }}
                />
              ))}
            </span>
          </button>
        </div>

        <nav aria-label="Primary" className="mt-3">
          <ul className="grid grid-cols-5 gap-1.5 sm:gap-3">
            {primaryNav.map((item, i) => {
              const NavIcon = navIcons[i];
              return (
                <li key={item.label} className="min-w-0">
                  <CpLink
                    to={item.to}
                    onAction={onOpenMenu}
                    className="cp-glass cp-press flex h-full w-full flex-col items-center justify-start px-1 py-2.5 text-center sm:px-2 sm:py-3"
                  >
                    <span className="cp-content flex flex-col items-center gap-1">
                      <NavIcon className="h-5 w-5 text-slate-100 sm:h-6 sm:w-6" />
                      <span className="cp-chrome-text text-[11px] font-bold leading-tight sm:text-sm">
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
