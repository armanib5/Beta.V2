"use client";

import { useState } from "react";
import { CityPinnedAppLogo, CityPinnedWordmark } from "@/components/brand/wordmark";
import { UltimatePin } from "@/components/brand/ultimate-pin";
import { CpLink } from "@/components/home/cp-link";
import { IconAlert, IconBriefcase, IconChat, IconShare } from "@/components/home/icons";
import { footerPrimaryLinks, footerSecondaryLinks, soon } from "@/lib/home-nav";

/** Bottom utility strip: app, share, feedback, issues, careers. */
export function UtilityRow() {
  const [shareNote, setShareNote] = useState<string | null>(null);

  async function shareSite() {
    const url = typeof window === "undefined" ? "" : window.location.origin + window.location.pathname;
    const payload = { title: "CityPinned", text: "One city. One flyer. One pin. One you.", url };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch {
      setShareNote(url);
    }
    window.setTimeout(() => setShareNote(null), 2600);
  }

  const items = [
    {
      icon: <CityPinnedAppLogo className="h-8 w-8" />,
      title: "CityPinned App",
      caption: "Coming Soon",
      to: soon,
    },
    {
      icon: <IconShare className="h-5 w-5 text-slate-200" />,
      title: "Share our site",
      caption: "CityPinned",
      to: { kind: "action", action: "share" } as const,
    },
    {
      icon: <IconChat className="h-5 w-5 text-slate-200" />,
      title: "Feedback",
      caption: undefined,
      to: soon,
    },
    {
      icon: <IconAlert className="h-5 w-5 text-slate-200" />,
      title: "Report an Issue",
      caption: undefined,
      to: soon,
    },
    {
      icon: <IconBriefcase className="h-5 w-5 text-slate-200" />,
      title: "Careers / Jobs",
      caption: "Opportunities",
      to: soon,
    },
  ];

  return (
    <div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {items.map((item) => (
          <li key={item.title}>
            <CpLink
              to={item.to}
              onAction={(action) => action === "share" && shareSite()}
              className="cp-glass cp-press flex h-full w-full items-center gap-2.5 px-3 py-3 text-left"
            >
              <span className="cp-content flex items-center gap-2.5">
                <span className="shrink-0">{item.icon}</span>
                <span className="min-w-0">
                  <span className="cp-chrome-text block text-[12px] font-semibold leading-tight">
                    {item.title}
                  </span>
                  {item.caption && (
                    <span className="block text-[11px] leading-tight text-slate-400">
                      {item.caption}
                    </span>
                  )}
                </span>
              </span>
            </CpLink>
          </li>
        ))}
      </ul>
      {shareNote && (
        <p role="status" className="mt-2 text-center text-[12px] text-slate-400">
          {shareNote}
        </p>
      )}
    </div>
  );
}

/** Full website footer — the same destinations as the header and menu. */
export function HomeFooter({
  isSignedIn,
  onOpenMenu,
}: {
  isSignedIn: boolean;
  onOpenMenu: () => void;
}) {
  return (
    <footer className="mt-8 border-t border-white/10 bg-[#050506] pb-10 pt-8">
      <div className="mx-auto w-full max-w-[560px] px-4 sm:max-w-3xl sm:px-6 lg:max-w-6xl">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <UltimatePin className="h-10 w-auto" />
            <CityPinnedWordmark className="w-[160px] text-[30px]" />
          </div>
          <p className="text-center text-[12px] uppercase tracking-[0.28em] text-slate-500 sm:text-right">
            One city. One flyer. One pin. One you.
          </p>
        </div>

        <div className="cp-rule my-6" />

        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] sm:gap-x-6">
            {footerPrimaryLinks(isSignedIn).map((link, i, all) => (
              <li key={link.label} className="flex items-center gap-4 sm:gap-6">
                <CpLink
                  to={link.to}
                  onAction={onOpenMenu}
                  className="cp-chrome-text font-semibold hover:brightness-125"
                >
                  {link.label}
                </CpLink>
                {i < all.length - 1 && (
                  <span aria-hidden="true" className="text-slate-600">
                    •
                  </span>
                )}
              </li>
            ))}
          </ul>

          <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-slate-400 sm:gap-x-6">
            {footerSecondaryLinks.map((link, i, all) => (
              <li key={link.label} className="flex items-center gap-4 sm:gap-6">
                <CpLink to={link.to} className="hover:text-slate-200">
                  {link.label}
                </CpLink>
                {i < all.length - 1 && (
                  <span aria-hidden="true" className="text-slate-600">
                    •
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-5 text-center text-[12px] text-slate-500">
          © CityPinned. All rights reserved.
        </p>

        <div className="mt-6 flex justify-center">
          <UltimatePin className="h-14 w-auto opacity-80" glow />
        </div>
      </div>
    </footer>
  );
}
