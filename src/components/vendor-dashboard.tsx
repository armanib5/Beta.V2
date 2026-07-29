"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, type Category, type LovEntry, type MenuItem, type PricingTier, type Vendor, type VendorPhoto } from "@/lib/types";
import { VendorPhotoManager } from "@/components/vendor-photo-manager";
import { MenuHubManager } from "@/components/menu-hub-manager";
import { MyListingManager } from "@/components/my-listing-manager";
import type { VendorStatus } from "@/lib/types";

const STATUS_DISPLAY: Record<VendorStatus, { label: string; style: string }> = {
  active: { label: "✅ Approved / Active", style: "border-green-300 bg-green-50 text-green-800" },
  pending: { label: "⏳ Unapproved / Pending Review", style: "border-amber-300 bg-amber-50 text-amber-800" },
  suspended: { label: "⏸ Suspended / Inactive", style: "border-orange-300 bg-orange-50 text-orange-800" },
  rejected: { label: "✕ Not Approved", style: "border-red-300 bg-red-50 text-red-800" },
};

function BoostRequest({ vendor, tiers }: { vendor: Vendor; tiers: PricingTier[] }) {
  const [requestedAt, setRequestedAt] = useState(vendor.boost_requested_at);
  const [requesting, setRequesting] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  if (vendor.is_top10) {
    return (
      <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-slate-900">🏆 You&apos;re Top 10 / Featured</h2>
        <p className="mt-1 text-sm text-slate-700">All premium badges are already active on your listing.</p>
      </div>
    );
  }

  async function requestBoost() {
    setRequesting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("vendors")
      .update({ boost_requested_at: new Date().toISOString() })
      .eq("id", vendor.id);
    setRequesting(false);
    if (!error) setRequestedAt(new Date().toISOString());
  }

  async function redeemCode(e: React.FormEvent) {
    e.preventDefault();
    if (!promoCode.trim()) return;
    setRedeeming(true);
    setRedeemError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("redeem_promo_code", { p_code: promoCode.trim().toUpperCase() });
    setRedeeming(false);
    if (error || !data?.ok) {
      setRedeemError(error?.message ?? data?.error ?? "Could not redeem that code.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Boost / Feature Your Listing</h2>
      <p className="mt-1 text-sm text-slate-600">
        Get a gold Top 10 badge and priority placement across the Board, Map, and Directory.
      </p>
      {vendor.opens_at && new Date(vendor.opens_at) > new Date() && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          📅 Your flyer will show &quot;Opens {new Date(vendor.opens_at).toLocaleDateString("en-US")}&quot; until
          then, even while boosted/featured — boosting doesn&apos;t make you show as open early.
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {tiers.map((tier) => (
          <div key={tier.id} className="rounded-xl border border-slate-200 p-4">
            <p className="font-bold text-slate-900">{tier.name}</p>
            <p className="text-sm text-slate-600">{formatPrice(tier.price_cents)}</p>
            {tier.stripe_payment_link ? (
              <a
                href={tier.stripe_payment_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Pay & Upgrade
              </a>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Contact us to pay for this tier.</p>
            )}
          </div>
        ))}
      </div>
      {requestedAt ? (
        <p className="mt-4 text-sm font-medium text-amber-700">
          ⏳ Requested {new Date(requestedAt).toLocaleDateString("en-US")} — an admin will review and activate it.
        </p>
      ) : (
        <button
          type="button"
          onClick={requestBoost}
          disabled={requesting}
          className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {requesting ? "Requesting…" : "I've paid — request activation"}
        </button>
      )}

      <form onSubmit={redeemCode} className="mt-6 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4">
        <div>
          <label className="block text-xs font-medium text-slate-700">Have a promo code?</label>
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
          />
        </div>
        <button
          type="submit"
          disabled={redeeming}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {redeeming ? "Redeeming…" : "Redeem"}
        </button>
        {redeemError && <p className="w-full text-xs font-medium text-red-600">{redeemError}</p>}
      </form>
    </div>
  );
}

export function VendorDashboard({
  vendor,
  categories,
  selectedCategoryIds,
  photos,
  tiers,
  myListings,
  menuItems,
}: {
  vendor: Vendor;
  categories: Category[];
  selectedCategoryIds: string[];
  photos: VendorPhoto[];
  tiers: PricingTier[];
  myListings: LovEntry[];
  menuItems: MenuItem[];
}) {
  const router = useRouter();
  const isMenuHubEntity = vendor.entity_type === "restaurant" || vendor.entity_type === "bar";

  const [form, setForm] = useState({
    business_name: vendor.business_name,
    owner_name: vendor.owner_name ?? "",
    phone: vendor.phone ?? "",
    instagram_handle: vendor.instagram_handle ?? "",
    website_url: vendor.website_url ?? "",
    short_description: vendor.short_description ?? "",
    opens_at: vendor.opens_at ?? "",
  });
  const [hubType, setHubType] = useState(vendor.hub_type);
  const [savingHubType, setSavingHubType] = useState(false);
  const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({
    lat: vendor.lat,
    lng: vendor.lng,
  });
  const [locating, setLocating] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(new Set(selectedCategoryIds));
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation isn't supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location — check location permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveHubType(next: typeof hubType) {
    setSavingHubType(true);
    const supabase = createClient();
    const { error: hubError } = await supabase.from("vendors").update({ hub_type: next }).eq("id", vendor.id);
    setSavingHubType(false);
    if (!hubError) setHubType(next);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const supabase = createClient();

      const { error: profileError } = await supabase
        .from("vendors")
        .update({
          business_name: form.business_name,
          owner_name: form.owner_name || null,
          phone: form.phone || null,
          instagram_handle: form.instagram_handle || null,
          website_url: form.website_url || null,
          short_description: form.short_description || null,
          opens_at: form.opens_at || null,
          lat: location.lat,
          lng: location.lng,
        })
        .eq("id", vendor.id);
      if (profileError) throw profileError;

      const toAdd = [...selectedCategories].filter((id) => !selectedCategoryIds.includes(id));
      const toRemove = selectedCategoryIds.filter((id) => !selectedCategories.has(id));

      if (toAdd.length) {
        const { error: addError } = await supabase
          .from("vendor_categories")
          .insert(toAdd.map((category_id) => ({ vendor_id: vendor.id, category_id })));
        if (addError) throw addError;
      }
      if (toRemove.length) {
        const { error: removeError } = await supabase
          .from("vendor_categories")
          .delete()
          .eq("vendor_id", vendor.id)
          .in("category_id", toRemove);
        if (removeError) throw removeError;
      }

      setSavedMessage("Saved!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const statusDisplay = STATUS_DISPLAY[vendor.status];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div
        className={`mb-4 inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-extrabold ${statusDisplay.style}`}
      >
        {statusDisplay.label}
      </div>
      {vendor.status === "pending" && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Pending review.</strong> We&apos;ll activate your account after confirming your
          payment — finish setting up your profile below in the meantime.
        </div>
      )}
      {vendor.status === "suspended" && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Your account is currently suspended. Contact us if you think this is a mistake.
        </div>
      )}
      {vendor.status === "rejected" && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Your account was not approved. Contact us if you think this is a mistake or want to
          resubmit.
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{vendor.business_name}</h1>
            {vendor.is_founding_vendor && (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                Founding Vendor
              </span>
            )}
            {vendor.is_top10 && (
              <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">
                🏆 Top 10
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Public profile:{" "}
            <Link href={`/vendor?slug=${encodeURIComponent(vendor.slug)}`} className="underline">
              /vendor?slug={vendor.slug}
            </Link>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            <Link href="/vendor/zones" className="underline">
              Claim a booth at an upcoming event →
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Sign Out
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Photos &amp; Logo</h2>
        <div className="mt-4">
          <VendorPhotoManager
            vendorId={vendor.id}
            logoUrl={vendor.logo_url}
            logoFocalX={vendor.logo_focal_x}
            logoFocalY={vendor.logo_focal_y}
            initialPhotos={photos}
          />
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Account Type</h2>
        <p className="mt-1 text-sm text-slate-600">
          What kind of hub is this account? This controls which button people see when they tap through from a
          flyer or the Directory.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { key: "vendor" as const, label: "🛒 Vendor Hub", desc: "A pop-up vendor at events (booths, boost/Top 10)." },
              { key: "menu" as const, label: "🍽️ Menu Hub", desc: "A restaurant/bar with its own menu, specials, and Top Picks." },
              { key: "hosting" as const, label: "🏠 Hosting Hub", desc: "A venue that hosts other people's events at your location." },
              { key: "show" as const, label: "🎭 Show Hub", desc: "A theater or performance center hosting ticketed shows." },
            ]
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={savingHubType}
              onClick={() => saveHubType(opt.key)}
              className={`rounded-xl border p-3 text-left text-sm disabled:opacity-60 ${
                hubType === opt.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              <p className="font-bold">{opt.label}</p>
              <p className={`mt-0.5 text-xs ${hubType === opt.key ? "text-slate-300" : "text-slate-500"}`}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <MyListingManager vendorId={vendor.id} initialListings={myListings} />

      {isMenuHubEntity && (
        <MenuHubManager vendorId={vendor.id} menuHubEnabled={vendor.menu_hub_enabled} initialItems={menuItems} />
      )}

      <BoostRequest vendor={vendor} tiers={tiers} />

      <form onSubmit={handleSave} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Profile Details</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <input
              type="text"
              value={form.business_name}
              onChange={(e) => updateField("business_name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </Field>
          <Field label="Owner name">
            <input
              type="text"
              value={form.owner_name}
              onChange={(e) => updateField("owner_name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Opening date (optional)">
            <input
              type="date"
              value={form.opens_at}
              onChange={(e) => updateField("opens_at", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Set this if you&apos;re boosting/featuring before you actually open — the flyer badge will show
              your real opening date instead of a misleading &quot;Open Now.&quot;
            </span>
          </Field>
          <Field label="Instagram handle">
            <input
              type="text"
              placeholder="@yourbusiness"
              value={form.instagram_handle}
              onChange={(e) => updateField("instagram_handle", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <input
              type="url"
              placeholder="https://"
              value={form.website_url}
              onChange={(e) => updateField("website_url", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Short description" className="sm:col-span-2">
            <textarea
              rows={3}
              maxLength={280}
              value={form.short_description}
              onChange={(e) => updateField("short_description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Location</p>
          <p className="mt-1 text-xs text-slate-500">
            Powers &quot;Near You&quot; sorting on the Vendor Directory.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {locating ? "Locating…" : "📍 Use My Current Location"}
            </button>
            {location.lat !== null && location.lng !== null && (
              <span className="text-xs text-slate-500">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Category tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((category) => {
              const active = selectedCategories.has(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {category.icon} {category.name}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {savedMessage && <p className="text-sm font-medium text-green-600">{savedMessage}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 sm:w-auto"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <AccountLoginSettings vendor={vendor} />
    </div>
  );
}

/** Lets a vendor set up their own real email/password — for accounts the
 * admin comped with a PIN and a placeholder @vendor.citypinned.app
 * address, this is how they take over their own login going forward. */
function AccountLoginSettings({ vendor }: { vendor: Vendor }) {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSessionEmail(data.user?.email ?? null));
  }, []);

  const isPinLogin = (sessionEmail ?? vendor.contact_email).endsWith("@vendor.citypinned.app");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!newEmail && !newPassword) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const update: { email?: string; password?: string } = {};
      if (newEmail) update.email = newEmail;
      if (newPassword) update.password = newPassword;
      const { error: updateError } = await supabase.auth.updateUser(update);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setMessage(
        newEmail
          ? "Check your new email for a confirmation link to finish the switch."
          : "Password updated.",
      );
      setNewEmail("");
      setNewPassword("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-10 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-bold text-slate-900">Account Login</h2>

      <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in as</p>
          <p className="font-medium text-slate-900">{sessionEmail ?? vendor.contact_email}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Login method</p>
          <p className="font-medium text-slate-900">{isPinLogin ? "Business ID + PIN" : "Email + password"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business ID (PIN login)</p>
          <p className="font-mono font-medium text-slate-900">{vendor.slug}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account ID</p>
          <p className="truncate font-mono text-xs font-medium text-slate-900" title={vendor.id}>
            {vendor.id}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        A password can&apos;t be shown once set (nobody — including us — can read it back), only replaced.
        Your Account ID never changes no matter how you log in, so it stays the same if this account is ever
        moved to a future version of CityPinned.
      </p>

      <p className="mt-4 text-sm text-slate-600">
        Set your own email and/or password below whenever you&rsquo;re ready — you don&rsquo;t have to keep
        using a PIN. This updates your login on our server, so it takes effect immediately on every device,
        not just this one.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 max-w-sm space-y-3">
        <input
          type="email"
          placeholder="New email (optional)"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
        <input
          type="password"
          placeholder="New password (optional)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {message && <p className="text-sm font-medium text-green-600">{message}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Update Login"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
