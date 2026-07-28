"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import type { LovEntry, Pin, PinCategory, PinStatus, Vendor } from "@/lib/types";

const CATEGORIES: PinCategory[] = ["food", "parking", "restroom", "safety", "business", "event"];
const STATUSES: PinStatus[] = ["draft", "pending", "approved", "expired"];

const STATUS_STYLE: Record<PinStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-700",
};

type OwnerType = "none" | "vendor" | "event";

export default function AdminPinsPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [pins, setPins] = useState<Pin[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | PinStatus>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | PinCategory>("all");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<PinCategory>("business");
  const [pinStatus, setPinStatus] = useState<PinStatus>("pending");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [ownerType, setOwnerType] = useState<OwnerType>("none");
  const [ownerId, setOwnerId] = useState("");

  async function loadAll() {
    const supabase = createClient();
    const [{ data: pinRows }, { data: vendorRows }, { data: eventRows }] = await Promise.all([
      supabase.from("pins").select("*").order("created_at", { ascending: false }).returns<Pin[]>(),
      supabase.from("vendors").select("*").eq("is_internal", false).returns<Vendor[]>(),
      supabase.from("lov_entries").select("*").eq("type", "event").returns<LovEntry[]>(),
    ]);
    setPins(pinRows ?? []);
    setVendors(vendorRows ?? []);
    setEvents(eventRows ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      await loadAll();
      if (cancelled) return;
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const filtered = pins.filter(
    (p) => (filterStatus === "all" || p.status === filterStatus) && (filterCategory === "all" || p.category === filterCategory),
  );

  async function addPin(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !lat.trim() || !lng.trim()) return;
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("pins")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        category,
        status: pinStatus,
        lat: Number(lat),
        lng: Number(lng),
        vendor_id: ownerType === "vendor" ? ownerId || null : null,
        event_id: ownerType === "event" ? ownerId || null : null,
      })
      .select("*")
      .single<Pin>();
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create pin.");
      return;
    }
    setPins((prev) => [data, ...prev]);
    setTitle("");
    setDescription("");
    setLat("");
    setLng("");
    setOwnerId("");
  }

  async function setPinStatusFor(pin: Pin, next: PinStatus) {
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("pins")
      .update({ status: next })
      .eq("id", pin.id)
      .select("*")
      .single<Pin>();
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not update pin.");
      return;
    }
    setPins((prev) => prev.map((p) => (p.id === pin.id ? data : p)));
  }

  async function deletePin(id: string) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("pins").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setPins((prev) => prev.filter((p) => p.id !== id));
  }

  if (status === "loading") {
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }
  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">🔒 Admin access required</h1>
        <Link href="/vendor/login" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Pins Manager</h1>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Only <strong>Approved</strong> pins show on the public Map. Draft/Pending/Expired stay admin-only.
      </p>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <form onSubmit={addPin} className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Public Restroom"
            className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PinCategory)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm capitalize"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Status</label>
          <select
            value={pinStatus}
            onChange={(e) => setPinStatus(e.target.value as PinStatus)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Lat</label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Lng</label>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Owner</label>
          <select
            value={ownerType}
            onChange={(e) => {
              setOwnerType(e.target.value as OwnerType);
              setOwnerId("");
            }}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="none">None</option>
            <option value="vendor">Vendor</option>
            <option value="event">Event</option>
          </select>
        </div>
        {ownerType !== "none" && (
          <div>
            <label className="block text-xs font-medium text-slate-700">{ownerType === "vendor" ? "Vendor" : "Event"}</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Choose…</option>
              {(ownerType === "vendor" ? vendors : events).map((o) => (
                <option key={o.id} value={o.id}>
                  {"business_name" in o ? o.business_name : o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="w-full">
          <label className="block text-xs font-medium text-slate-700">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Add Pin
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | PinStatus)}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold capitalize"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as "all" | PinCategory)}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold capitalize"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="self-center text-xs text-slate-500">{filtered.length} pins</span>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((pin) => {
          const owner = pin.vendor_id
            ? vendorById.get(pin.vendor_id)?.business_name
            : pin.event_id
              ? eventById.get(pin.event_id)?.name
              : null;
          return (
            <div key={pin.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {pin.title} <span className="text-xs font-normal capitalize text-slate-400">({pin.category})</span>
                </p>
                <p className="text-xs text-slate-500">
                  {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                  {owner ? ` — ${owner}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={pin.status}
                  onChange={(e) => setPinStatusFor(pin, e.target.value as PinStatus)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[pin.status]}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => deletePin(pin.id)} className="text-xs font-semibold text-red-600 underline">
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-slate-500">No pins match this filter.</p>}
      </div>
    </div>
  );
}
