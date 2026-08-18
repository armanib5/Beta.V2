"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { UltimatePin } from "@/components/brand/ultimate-pin";
import { CpLink } from "@/components/home/cp-link";
import {
  IconAlert,
  IconCalendar,
  IconChat,
  IconChevron,
  IconCompass,
  IconGear,
  IconHandshake,
  IconInfo,
  IconMapPin,
  IconPushPin,
  IconQuestion,
  IconStorefront,
  IconTag,
  IconUser,
  IconUserCircle,
  IconUserPlus,
} from "@/components/home/icons";
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

interface MenuItem extends CpNavItem {
  icon: ReactNode;
}

interface MenuSection {
  title: string;
  icon: ReactNode;
  items: MenuItem[];
}

const itemIcon = "h-[22px] w-[22px] shrink-0 text-slate-200";
const sectionIcon = "h-[22px] w-[22px] shrink-0 text-slate-100";

function sections(isSignedIn: boolean): MenuSection[] {
  return [
    {
      title: "Explore",
      icon: <IconCompass className={sectionIcon} />,
      items: [
        {
          label: "Corkboard",
          caption: "for the Board",
          to: staticPage(CORKBOARD_URL),
          icon: <IconPushPin className={itemIcon} />,
        },
        {
          label: "Pins",
          caption: "for the Map",
          to: staticPage(MAP_URL),
          icon: <IconMapPin className={itemIcon} />,
        },
        {
          label: "Full Directory",
          caption: "for Directory",
          to: route("/vendors"),
          icon: <IconStorefront className={itemIcon} />,
        },
        {
          label: "Become a Vendor",
          caption: "Free to List",
          to: hash("#pricing"),
          icon: <IconHandshake className={itemIcon} />,
        },
      ],
    },
    {
      title: "Information",
      icon: <IconInfo className={sectionIcon} />,
      items: [
        { label: "How It Works", to: soon, icon: <IconGear className={itemIcon} /> },
        {
          label: "Pricing & Promotions",
          to: hash("#pricing"),
          icon: <IconTag className={itemIcon} />,
        },
        { label: "Help & Support", to: soon, icon: <IconQuestion className={itemIcon} /> },
        { label: "Feedback", to: soon, icon: <IconChat className={itemIcon} /> },
        { label: "Report an Issue", to: soon, icon: <IconAlert className={itemIcon} /> },
        {
          label: "About CityPinned",
          to: soon,
          icon: <UltimatePin className="h-[22px] w-auto shrink-0" />,
        },
      ],
    },
    {
      title: "Account / Site",
      icon: <IconUser className={sectionIcon} />,
      items: [
        {
          label: "Create Account",
          to: route("/vendor/signup"),
          icon: <IconUserPlus className={itemIcon} />,
        },
        {
          label: "Profile",
          to: profileDestination(isSignedIn),
          icon: <IconUserCircle className={itemIcon} />,
        },
        { label: "Calendar", to: route("/calendar"), icon: <IconCalendar className={itemIcon} /> },
      ],
    },
  ];
}

const sectionId = (title: string) => `cp-menu-${title.replace(/\W+/g, "-").toLowerCase()}`;

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
    <div className="fixed inset-0 z-50 bg-black/45">
      {/* Backdrop click target — the page stays visible behind the panel */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-end p-2 sm:p-4">
        {/* Outer chrome frame */}
        <div
          className="cp-glass pointer-events-auto max-h-full w-[calc(100%-2.5rem)] max-w-[420px] p-2 sm:max-w-[460px] sm:p-2.5"
          style={{ borderRadius: 30 }}
        >
          <div
            id="cp-more-menu"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="CityPinned menu"
            tabIndex={-1}
            className="cp-matte-panel cp-hide-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain p-3 outline-none sm:p-4"
            style={{ borderRadius: 24 }}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <UltimatePin className="h-12 w-auto shrink-0" glow />
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="cp-chrome-text text-2xl font-extrabold leading-none">Menu</p>
                <p className="mt-1.5 text-[13px] leading-tight text-slate-400">
                  Explore everything CityPinned
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="cp-glass cp-press flex h-11 w-11 shrink-0 items-center justify-center text-lg text-slate-100"
                style={{ borderRadius: 16 }}
              >
                <span className="cp-content">✕</span>
              </button>
            </div>

            {/* Sections */}
            <div className="mt-3 space-y-3">
              {menuSections.map((section) => {
                const isOpen = !collapsed[section.title];
                return (
                  <section key={section.title} className="cp-glass px-3 py-2 sm:px-4">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={sectionId(section.title)}
                      onClick={() =>
                        setCollapsed((prev) => ({ ...prev, [section.title]: !prev[section.title] }))
                      }
                      className="flex w-full items-center gap-3 py-2 text-left"
                    >
                      {section.icon}
                      <span className="cp-chrome-text flex-1 text-[15px] font-bold uppercase tracking-[0.14em]">
                        {section.title}
                      </span>
                      <IconChevron
                        className={`h-5 w-5 text-slate-300 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <ul
                        id={sectionId(section.title)}
                        className="divide-y divide-white/10 border-t border-white/10"
                      >
                        {section.items.map((item) => (
                          <li key={item.label}>
                            <CpLink
                              to={item.to}
                              onNavigate={onClose}
                              className="cp-press flex w-full items-center gap-3.5 py-3 pl-1 pr-1 text-left"
                            >
                              {item.icon}
                              <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-semibold leading-tight text-slate-100">
                                  {item.label}
                                </span>
                                {item.caption && (
                                  <span className="block text-[12px] leading-tight text-slate-400">
                                    {item.caption}
                                  </span>
                                )}
                              </span>
                              {item.to.kind === "soon" && (
                                <span className="shrink-0 rounded-full border border-white/12 px-2 py-0.5 text-[9px] uppercase tracking-widest text-slate-500">
                                  Soon
                                </span>
                              )}
                            </CpLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
