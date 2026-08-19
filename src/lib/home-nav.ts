import { BASE_PATH } from "@/lib/site";

/**
 * Single source of truth for every destination the Home Screen links to, so
 * the header, the menu, the cards and the footer can never drift apart.
 *
 * Destinations are the app's real, existing routes:
 *   - "route"  → a Next.js page (client-side navigation via next/link)
 *   - "static" → one of the ported V1 pages living in public/ (needs a real
 *                page load and the basePath prefixed by hand)
 *   - "hash"   → an anchor on this page
 *   - "soon"   → no page exists for this yet; rendered as a non-navigating,
 *                clearly-labelled item rather than a dead link
 *   - "action" → handled in the browser (open the menu, share the site)
 */
export type CpDestination =
  | { kind: "route"; href: string }
  | { kind: "static"; href: string }
  | { kind: "hash"; href: string }
  | { kind: "soon" }
  | { kind: "action"; action: "menu" | "share" };

export interface CpNavItem {
  label: string;
  caption?: string;
  to: CpDestination;
}

export const CORKBOARD_URL = `${BASE_PATH}/board/`;
export const MAP_URL = `${BASE_PATH}/map/`;
export const ADD_PIN_URL = `${BASE_PATH}/pins/`;

export const route = (href: string): CpDestination => ({ kind: "route", href });
export const staticPage = (href: string): CpDestination => ({ kind: "static", href });
export const hash = (href: string): CpDestination => ({ kind: "hash", href });
export const soon: CpDestination = { kind: "soon" };

/** Top navigation — four primary destinations plus the "More" opener. */
export const primaryNav: CpNavItem[] = [
  { label: "Corkboard", caption: "for the Board", to: staticPage(CORKBOARD_URL) },
  { label: "Pins", caption: "for the Map", to: staticPage(MAP_URL) },
  { label: "Directory", caption: "Full Directory", to: route("/vendors") },
  { label: "Vendor", caption: "Become a Vendor", to: hash("#pricing") },
  { label: "More", caption: "See all options", to: { kind: "action", action: "menu" } },
];

/** Profile / dashboard target depends on the visitor's Supabase session. */
export function profileDestination(isSignedIn: boolean): CpDestination {
  return route(isSignedIn ? "/vendor/dashboard" : "/vendor/login");
}

export const footerPrimaryLinks = (isSignedIn: boolean): CpNavItem[] => [
  { label: "Corkboard", to: staticPage(CORKBOARD_URL) },
  { label: "Pins", to: staticPage(MAP_URL) },
  { label: "Directory", to: route("/vendors") },
  { label: "Vendor", to: hash("#pricing") },
  { label: "Calendar", to: route("/calendar") },
  { label: "Profile", to: profileDestination(isSignedIn) },
  { label: "More", to: { kind: "action", action: "menu" } },
];

export const footerSecondaryLinks: CpNavItem[] = [
  { label: "About", to: soon },
  { label: "Help & Support", to: soon },
  { label: "Privacy", to: soon },
  { label: "Terms", to: soon },
  { label: "Contact", to: soon },
];
