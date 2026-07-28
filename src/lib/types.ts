export type VendorStatus = "pending" | "active" | "suspended";
export type RegistrationStatus = "pending" | "paid" | "failed" | "refunded";
export type EntityType = "vendor" | "restaurant" | "bar";
export type CategoryTier = "top_10" | "featured" | "standard";

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
  entity_type: EntityType;
  category_tier: CategoryTier;
  operating_hours: Record<string, string> | null;
  happy_hour_specials: string | null;
  menu_url: string | null;
  is_featured: boolean;
  boost_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LovEntryType = "event" | "vendor";
export type BoothTier = "top" | "standard";
export type BoothStatus = "open" | "reserved" | "occupied";

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
  section_zone: string | null;
  publish_at: string | null;
  details: string | null;
  status: FlyerStatus;
  category_tier: CategoryTier;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export type FlyerStatus = "active" | "draft" | "pending" | "archived";
export type FlyerBoard = "master" | "weekly" | "today";

export interface FlyerRotation {
  id: string;
  flyer_id: string;
  assigned_board: FlyerBoard;
  assigned_day: string | null;
  category: string | null;
  status: FlyerStatus;
  created_at: string;
  updated_at: string;
}

export interface Booth {
  id: string;
  event_id: string;
  label: string;
  booth_number: number | null;
  tier: BoothTier;
  status: BoothStatus;
  vendor_id: string | null;
  lov_entry_id: string | null;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
}

export type BoundaryType = "fence" | "gate" | "exit" | "vendor_area";

export interface ZoneBoundaryPoint {
  x: number;
  y: number;
}

export interface ZoneBoundary {
  id: string;
  event_id: string;
  boundary_type: BoundaryType;
  label: string | null;
  points: ZoneBoundaryPoint[];
  vendor_id: string | null;
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

export interface PromoCode {
  id: string;
  code: string;
  tier_id: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
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

export type ActivityEntityType = "vendor" | "event" | "booth";

export interface ActivityLog {
  id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  entity_name: string;
  action: string;
  detail: string | null;
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
