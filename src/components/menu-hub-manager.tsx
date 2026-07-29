"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, type MenuItem, type MenuItemKind } from "@/lib/types";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const TOP_PICK_LIMIT = 5;

function emptyForm() {
  return { kind: "bite" as MenuItemKind, name: "", price: "", description: "" };
}

export function MenuHubManager({
  vendorId,
  menuHubEnabled,
  initialItems,
}: {
  vendorId: string;
  menuHubEnabled: boolean;
  initialItems: MenuItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [enabled, setEnabled] = useState(menuHubEnabled);
  const [togglingHub, setTogglingHub] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bites = items.filter((i) => i.kind === "bite");
  const sips = items.filter((i) => i.kind === "sip");

  async function toggleHub() {
    setTogglingHub(true);
    const supabase = createClient();
    const next = !enabled;
    const { error: toggleError } = await supabase
      .from("vendors")
      .update({ menu_hub_enabled: next })
      .eq("id", vendorId);
    setTogglingHub(false);
    if (!toggleError) setEnabled(next);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    setAdding(true);
    try {
      const supabase = createClient();
      const priceCents = form.price.trim() ? Math.round(parseFloat(form.price) * 100) : null;
      const { data, error: insertError } = await supabase
        .from("menu_items")
        .insert({
          vendor_id: vendorId,
          kind: form.kind,
          name: form.name.trim(),
          description: form.description.trim() || null,
          price_cents: Number.isFinite(priceCents) ? priceCents : null,
          sort_order: items.filter((i) => i.kind === form.kind).length,
        })
        .select("*")
        .single<MenuItem>();
      if (insertError || !data) throw insertError ?? new Error("Could not add item.");
      setItems((prev) => [...prev, data]);
      setForm(emptyForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item.");
    } finally {
      setAdding(false);
    }
  }

  async function uploadItemPhoto(item: MenuItem, file: File) {
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("Images must be under 8MB.");
      return;
    }
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${vendorId}/menu/${item.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("vendor-photos").upload(path, file, { upsert: true });
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    const { data } = supabase.storage.from("vendor-photos").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({ photo_url: data.publicUrl })
      .eq("id", item.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, photo_url: data.publicUrl } : i)));
  }

  async function toggleTopPick(item: MenuItem) {
    setError(null);
    const kindCount = items.filter((i) => i.kind === item.kind && i.is_top_pick).length;
    if (!item.is_top_pick && kindCount >= TOP_PICK_LIMIT) {
      setError(`Only ${TOP_PICK_LIMIT} Top Pick ${item.kind}s allowed — remove one first.`);
      return;
    }
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({ is_top_pick: !item.is_top_pick })
      .eq("id", item.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_top_pick: !i.is_top_pick } : i)));
  }

  async function deleteItem(item: MenuItem) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">🍽️ Menu Hub</h2>
          <p className="mt-1 text-sm text-slate-600">
            Your Bites &amp; Sips hub — happy hour specials, menu items with photos and prices, and up to{" "}
            {TOP_PICK_LIMIT} Top Pick bites + {TOP_PICK_LIMIT} Top Pick sips. Free to use — no boost purchase
            required for Top Picks.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleHub}
          disabled={togglingHub}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
            enabled ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"
          }`}
        >
          {togglingHub ? "…" : enabled ? "✓ Menu Hub On" : "Menu Hub Off"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <MenuKindSection title="🥟 Bites" items={bites} onUpload={uploadItemPhoto} onToggleTopPick={toggleTopPick} onDelete={deleteItem} />
      <MenuKindSection title="🥤 Sips" items={sips} onUpload={uploadItemPhoto} onToggleTopPick={toggleTopPick} onDelete={deleteItem} />

      <form onSubmit={addItem} className="mt-6 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4">
        <div>
          <label className="block text-xs font-medium text-slate-700">Type</label>
          <select
            value={form.kind}
            onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value as MenuItemKind }))}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="bite">Bite</option>
            <option value="sip">Sip</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Item name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="mt-1 w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={form.price}
            onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
            className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Description (optional)</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="mt-1 w-52 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {adding ? "Adding…" : "+ Add Item"}
        </button>
      </form>
    </div>
  );
}

function MenuKindSection({
  title,
  items,
  onUpload,
  onToggleTopPick,
  onDelete,
}: {
  title: string;
  items: MenuItem[];
  onUpload: (item: MenuItem, file: File) => void;
  onToggleTopPick: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
            <label className="relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {item.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl text-slate-300">+</span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(item, file);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
              {item.price_cents != null && (
                <p className="text-xs text-slate-600">{formatPrice(item.price_cents)}</p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleTopPick(item)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.is_top_pick ? "bg-amber-400 text-slate-900" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.is_top_pick ? "★ Top Pick" : "Make Top Pick"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  className="text-[10px] font-semibold text-red-600 underline"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
