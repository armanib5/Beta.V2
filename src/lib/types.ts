export type VendorStatus = "pending" | "active" | "suspended" | "rejected";
export type VendorHubType = "vendor" | "menu" | "hosting" | "show";
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

export type RelationshipStatus =
  | "contacted"
  | "interested"
  | "onboarding"
  | "active_vendor"
  | "inactive"
  | "needs_followup";

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
  approved_at: string | null;
  rejected_at: string | null;
  is_internal: boolean;
  entity_type: EntityType;
  category_tier: CategoryTier;
  operating_hours: Record<string, string> | null;
  happy_hour_specials: string | null;
  menu_url: string | null;
  is_featured: boolean;
  boost_requested_at: string | null;
  boost_expires_at: string | null;
  boost_active_until: string | null;
  menu_hub_enabled: boolean;
  opens_at: string | null;
  hub_type: VendorHubType;
  logo_focal_x: number;
  logo_focal_y: number;
  relationship_status: RelationshipStatus | null;
  last_contact_date: string | null;
  next_followup_date: string | null;
  location_verified_at: string | null;
  is_test_account: boolean;
  created_at: string;
  updated_at: string;
}

export type MenuItemKind = "bite" | "sip";
export type MenuItemStatus = "active" | "hidden";

export interface MenuItem {
  id: string;
  vendor_id: string;
  kind: MenuItemKind;
  name: string;
  description: string | null;
  price_cents: number | null;
  photo_url: string | null;
  is_top_pick: boolean;
  sort_order: number;
  status: MenuItemStatus;
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
  hosting_vendor_id: string | null;
  flyer_focal_x: number;
  flyer_focal_y: number;
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
  /** Real-world coordinates, set only for booths placed via the Leaflet
   * Event Zone editor - null for legacy percentage-grid booths (x/y). */
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
}

export type BoundaryType = "fence" | "gate" | "exit" | "vendor_area" | "event_boundary" | "path";

export interface ZoneBoundaryPoint {
  x: number;
  y: number;
}

export interface ZoneBoundaryGeoPoint {
  lat: number;
  lng: number;
}

export interface ZoneBoundary {
  id: string;
  event_id: string;
  boundary_type: BoundaryType;
  label: string | null;
  points: ZoneBoundaryPoint[];
  /** Real-world traced boundary, set only via the Leaflet Event Zone
   * editor - null for legacy percentage-grid boundaries (points). */
  points_geo: ZoneBoundaryGeoPoint[] | null;
  vendor_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ZoneFeatureType =
  | "stage"
  | "seating"
  | "food"
  | "bar"
  | "gate"
  | "entrance"
  | "exit"
  | "info"
  | "restroom";

/** Point-placed event infrastructure (stage, restroom, gate marker, etc.)
 * inside a traced event boundary - never vendor-claimable, so it lives in
 * its own table rather than as a `booths` row (see migration 0059). */
export interface ZoneFeature {
  id: string;
  event_id: string;
  feature_type: ZoneFeatureType;
  label: string | null;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
}

export interface VendorBoostBooking {
  id: string;
  vendor_id: string;
  tier_id: string | null;
  registration_id: string | null;
  slot_start: string;
  slot_end: string;
  created_at: string;
}

export type AdminNoteEntityType = "vendor" | "event";
export type AdminNoteType = "meeting" | "followup" | "partnership" | "conversation" | "communication" | "context";

export interface AdminNote {
  id: string;
  entity_type: AdminNoteEntityType;
  entity_id: string;
  note_type: AdminNoteType;
  body: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
  updated_by_email: string | null;
}

export interface AdminNoteRevision {
  id: string;
  note_id: string;
  previous_body: string;
  edited_by_email: string;
  edited_at: string;
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

export interface PromoCodeGrant {
  id: string;
  promo_code_id: string;
  vendor_id: string;
  created_at: string;
}

export interface PromoRedemption {
  id: string;
  promo_code_id: string;
  vendor_id: string;
  tier_id: string;
  registration_id: string | null;
  redeemed_at: string;
}

export interface CartItem {
  id: string;
  vendor_id: string;
  tier_id: string;
  added_at: string;
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
  stripe_fee_cents: number | null;
  platform_fee_cents: number | null;
  net_payout_cents: number | null;
}

export interface VendorStatusLog {
  id: string;
  vendor_id: string;
  old_status: VendorStatus | null;
  new_status: VendorStatus;
  changed_at: string;
}

export interface AccountLegalAgreement {
  id: string;
  user_id: string;
  terms_version: string;
  agreed_at: string;
  user_ip: string | null;
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

export type NoticeType = "danger_zone";
export type NoticeStatus = "active" | "resolved";

/** An admin-drawn circular map zone the public should temporarily avoid
 * (Danger Zone today; the foundation for a future V3 verified-city/
 * government notice system - see migration 0060). */
export interface PublicNotice {
  id: string;
  notice_type: NoticeType;
  title: string;
  description: string | null;
  status: NoticeStatus;
  lat: number;
  lng: number;
  radius_meters: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export function formatPrice(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
