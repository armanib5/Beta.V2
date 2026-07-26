export type VendorStatus = "pending" | "active" | "suspended";
export type RegistrationStatus = "pending" | "paid" | "failed" | "refunded";

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface PricingTier {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  is_top10: boolean;
  is_founding: boolean;
  max_slots: number | null;
  slots_claimed: number;
  stripe_price_id: string | null;
  stripe_payment_link: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  slug: string;
  business_name: string;
  owner_name: string | null;
  contact_email: string;
  phone: string | null;
  instagram_handle: string | null;
  website_url: string | null;
  short_description: string | null;
  logo_url: string | null;
  status: VendorStatus;
  is_founding_vendor: boolean;
  is_top10: boolean;
  tier_id: string | null;
  lat: number | null;
  lng: number | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LovEntryType = "event" | "vendor";
export type BoothTier = "top" | "regular";
export type BoothStatus = "open" | "reserved" | "claimed";

export interface LovEntry {
  id: string;
  type: LovEntryType;
  name: string;
  event_date: string | null;
  end_date: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  instagram_handle: string | null;
  category_id: string | null;
  booth_tier: BoothTier;
  flyer_image_url: string | null;
  vendor_id: string | null;
  recurrence: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booth {
  id: string;
  event_id: string;
  label: string;
  tier: BoothTier;
  status: BoothStatus;
  vendor_id: string | null;
  x: number | null;
  y: number | null;
  created_at: string;
  updated_at: string;
}

export interface VendorPhoto {
  id: string;
  vendor_id: string;
  storage_path: string;
  url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface Registration {
  id: string;
  tier_id: string;
  claimed_by_vendor_id: string | null;
  business_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_cents: number;
  currency: string;
  status: RegistrationStatus;
  awarded_top10: boolean;
  paid_at: string | null;
  created_at: string;
}

export function formatPrice(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
