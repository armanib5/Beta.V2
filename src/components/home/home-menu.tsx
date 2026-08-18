"use client";

import { useEffect, useRef, useState } from "react";
import { CityPinnedWordmark } from "@/components/brand/wordmark";
import { UltimatePin } from "@/components/brand/ultimate-pin";
import { CpLink } from "@/components/home/cp-link";
import { IconChevron } from "@/components/home/icons";
import {
  CORKBOARD_URL,
  MAP_URL,
  hash,
  profileDestination,
  route,
  soon,
  staticPage,
  type CpNavItem,
} from "@/lib/home-nav";

interface MenuSection {
  title: string;
  items: CpNavItem[];
}

function sections(isSignedIn: boolean): MenuSection[] {
  return [
    {
      title: "Explore",
      items: [
        { label: "Corkboard", caption: "for the Board", to: staticPage(CORKBOARD_URL) },
        { label: "Pins", caption: "for the Map", to: staticPage(MAP_URL) },
        { label: "Full Directory", caption: "for Directory", to: route("/vendors") },
        { label: "Become a Vendor", caption: "Free to List", to: hash("#pricing") },
      ],
    },
    {
      title: "Information",
      items: [
        { label: "How It Works", to: soon },
        { label: "Pricing & Promotions", caption: "Founding vendor tiers", to: hash("#pricing") },
        { label: "Help & Support", to: soon },
        { label: "Feedback", to: soon },
        { label: "Report an Issue", to: soon },
        { label: "About CityPinned", to: soon },
      ],
    },
    {
      title: "Account / Site",
      items: [
        { label: "Create Account", caption: "Vendor sign-up", to: route("/vendor/signup") },
        {
          label: "Profile",
          caption: isSignedIn ? "My dashboard" : "Vendor login",
          to: profileDestination(isSignedIn),
        },
        { label: "Calendar", caption: "Events by month", to: route("/calendar") },
      ],
    },
  ];
}

export function HomeMenu({
  open,
  onClose,
  isSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  isSignedIn: boolean;
}) {
  const menuSections = sections(isSignedIn);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes; the page behind stays put while the panel is open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-black/75 px-3 py-4 backdrop-blur-md sm:px-6">
      {/* Backdrop click target */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />

      <div
        id="cp-more-menu"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="CityPinned menu"
        tabIndex={-1}
        className="cp-glass relative z-10 my-auto h-fit w-full max-w-[520px] p-4 outline-none sm:p-6"
      >
        <div className="cp-content">
          <div className="flex items-center gap-3">
            <UltimatePin className="h-10 w-auto" />
            <CityPinnedWordmark className="w-[150px] text-[26px]" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="cp-glass cp-press ml-auto flex h-10 w-10 items-center justify-center text-lg text-slate-200"
              style={{ borderRadius: 14 }}
            >
              <span className="cp-content">✕</span>
            </button>
          </div>

          <div className="cp-rule my-4" />

          <div className="space-y-3">
            {menuSections.map((section) => {
              const isOpen = !collapsed[section.title];
              return (
                <section key={section.title} className="cp-matte-panel p-3">
                  <div className="cp-content">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`cp-menu-${section.title.replace(/\W+/g, "-").toLowerCase()}`}
                      onClick={() =>
                        setCollapsed((prev) => ({ ...prev, [section.title]: !collapsed[section.title] }))
                      }
                      className="flex w-full items-center justify-between gap-3 px-1 py-1 text-left"
                    >
                      <span className="cp-chrome-text text-xs font-bold uppercase tracking-[0.25em]">
                        {section.title}
                      </span>
                      <IconChevron
                        className={`h-5 w-5 text-slate-300 transition-transform duration-200 ${
                          isOpen ? "" : "-rotate-90"
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <ul
                        id={`cp-menu-${section.title.replace(/\W+/g, "-").toLowerCase()}`}
                        className="mt-2 space-y-2"
                      >
                        {section.items.map((item) => (
                          <li key={item.label}>
                            <CpLink
                              to={item.to}
                              onNavigate={onClose}
                              className="cp-glass cp-press flex items-center justify-between gap-3 px-4 py-3"
                            >
                              <span className="cp-content flex min-w-0 flex-col">
                                <span className="cp-chrome-text text-sm font-semibold">
                                  {item.label}
                                </span>
                                {item.caption && (
                                  <span className="text-[11px] text-slate-400">{item.caption}</span>
                                )}
                                {item.to.kind === "soon" && (
                                  <span className="text-[10px] uppercase tracking-widest text-slate-500">
                                    Coming soon
                                  </span>
                                )}
                              </span>
                            </CpLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
