"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import type { Category, FlyerBoard, FlyerRotation, FlyerStatus, LovEntry, Vendor } from "@/lib/types";
import { FlyerCropEditor } from "@/components/flyer-crop-editor";

const MAX_FLYER_PHOTO_BYTES = 8 * 1024 * 1024;

const WEEKDAYS: { code: string; label: string }[] = [
  { code: "mon", label: "Monday" },
  { code: "tue", label: "Tuesday" },
  { code: "wed", label: "Wednesday" },
  { code: "thu", label: "Thursday" },
  { code: "fri", label: "Friday" },
  { code: "sat", label: "Saturday" },
  { code: "sun", label: "Sunday" },
];

const BOARD_LABEL: Record<FlyerBoard, string> = {
  master: "Board 1 — Master / Seasonal",
  weekly: "Board 2 — This Week",
  today: "Board 3 — Today",
};

export default function AdminFlyersPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [flyers, setFlyers] = useState<LovEntry[]>([]);
  const [rotations, setRotations] = useState<FlyerRotation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [flyerId, setFlyerId] = useState("");
  const [board, setBoard] = useState<FlyerBoard>("weekly");
  const [weekday, setWeekday] = useState("mon");
  const [todayDate, setTodayDate] = useState("");
  const [category, setCategory] = useState("");
  const [rotStatus, setRotStatus] = useState<FlyerStatus>("active");
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const [croppingFlyer, setCroppingFlyer] = useState<LovEntry | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hosts, setHosts] = useState<Vendor[]>([]);
  const [editingFlyerId, setEditingFlyerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    event_date: "",
    end_date: "",
    location: "",
    details: "",
    category_id: "",
    hosting_vendor_id: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  async function loadAll() {
    const supabase = createClient();
    const [{ data: flyerRows }, { data: rotationRows }, { data: categoryRows }, { data: hostRows }] = await Promise.all([
      supabase.from("lov_entries").select("*").order("event_date", { ascending: false }).returns<LovEntry[]>(),
      supabase.from("flyer_rotation").select("*").order("assigned_board").returns<FlyerRotation[]>(),
      supabase.from("categories").select("*").order("name").returns<Category[]>(),
      supabase.from("vendors").select("*").eq("status", "active").order("business_name").returns<Vendor[]>(),
    ]);
    setFlyers(flyerRows ?? []);
    setRotations(rotationRows ?? []);
    setCategories(categoryRows ?? []);
    setHosts(hostRows ?? []);
  }

  function startEditFlyer(f: LovEntry) {
    setEditingFlyerId(f.id);
    setEditForm({
      name: f.name,
      event_date: f.event_date ?? "",
      end_date: f.end_date ?? "",
      location: f.location ?? "",
      details: f.details ?? "",
      category_id: f.category_id ?? "",
      hosting_vendor_id: f.hosting_vendor_id ?? "",
    });
  }

  async function saveFlyerEdit(f: LovEntry) {
    setSavingEdit(true);
    setError(null);
    const supabase = createClient();
    const patch = {
      name: editForm.name.trim(),
      event_date: editForm.event_date || null,
      end_date: editForm.end_date || null,
      location: editForm.location.trim() || null,
      details: editForm.details.trim() || null,
      category_id: editForm.category_id || null,
      hosting_vendor_id: editForm.hosting_vendor_id || null,
    };
    const { error: updateError } = await supabase.from("lov_entries").update(patch).eq("id", f.id);
    setSavingEdit(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setFlyers((prev) => prev.map((row) => (row.id === f.id ? { ...row, ...patch } : row)));
    logActivity(supabase, "event", f.id, patch.name, "CityPinned Admin edited flyer", `Updated by admin`);
    setEditingFlyerId(null);
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

  const flyerById = useMemo(() => new Map(flyers.map((f) => [f.id, f])), [flyers]);
  const pendingFlyers = useMemo(() => flyers.filter((f) => f.status === "pending"), [flyers]);

  async function setFlyerStatus(id: string, next: FlyerStatus) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("lov_entries").update({ status: next }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setFlyers((prev) => prev.map((f) => (f.id === id ? { ...f, status: next } : f)));
  }

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!flyerId) return;
    setError(null);
    const supabase = createClient();
    const assignedDay = board === "weekly" ? weekday : board === "today" ? todayDate || null : null;
    const { data, error: insertError } = await supabase
      .from("flyer_rotation")
      .insert({
        flyer_id: flyerId,
        assigned_board: board,
        assigned_day: assignedDay,
        category: category.trim() || null,
        status: rotStatus,
      })
      .select("*")
      .single<FlyerRotation>();
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create assignment.");
      return;
    }
    setRotations((prev) => [...prev, data]);
    setCategory("");
  }

  async function removeAssignment(id: string) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("flyer_rotation").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRotations((prev) => prev.filter((r) => r.id !== id));
  }

  async function cycleAssignmentStatus(rotation: FlyerRotation) {
    const next: FlyerStatus =
      rotation.status === "active" ? "draft" : rotation.status === "draft" ? "archived" : "active";
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("flyer_rotation")
      .update({ status: next })
      .eq("id", rotation.id)
      .select("*")
      .single<FlyerRotation>();
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not update status.");
      return;
    }
    setRotations((prev) => prev.map((r) => (r.id === rotation.id ? data : r)));
  }

  async function uploadFlyerPhoto(flyer: LovEntry, file: File) {
    setError(null);
    if (file.size > MAX_FLYER_PHOTO_BYTES) {
      setError("Images must be under 8MB.");
      return;
    }
    setUploadingPhotoId(flyer.id);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in.");
      const ext = file.name.split(".").pop() ?? "jpg";
      // eslint-disable-next-line react-hooks/purity -- runs only inside this async upload handler, never during render
      const ts = Date.now();
      const path = `${userData.user.id}/flyers/${flyer.id}-${ts}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("vendor-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("vendor-photos").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("lov_entries")
        .update({ flyer_image_url: publicUrl.publicUrl })
        .eq("id", flyer.id);
      if (updateError) throw updateError;
      setFlyers((prev) => prev.map((f) => (f.id === flyer.id ? { ...f, flyer_image_url: publicUrl.publicUrl } : f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploadingPhotoId(null);
    }
  }

  if (status === "loading") {
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Admin access required</h1>
        <p className="mt-3 text-sm text-slate-600">
          Log in with an account listed in the <code>admins</code> table to manage flyer rotation.
        </p>
        <Link href="/vendor/login" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Flyer Rotation</h1>
        <Link href="/admin/board" className="text-sm font-semibold text-slate-700 underline">
          Venue Board →
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Pin a flyer to Board 1 (Master), Board 2 (This Week, one weekday), or Board 3 (Today, one specific
        date). The board rolls over automatically at midnight — no manual refresh needed.
      </p>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      {pendingFlyers.length > 0 && (
        <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <h2 className="font-bold text-amber-900">⏳ Pending Review ({pendingFlyers.length})</h2>
          <p className="mt-1 text-xs text-amber-800">
            Submitted by a vendor or a public visitor via the Board&apos;s &quot;Post a Flyer&quot; — not
            visible anywhere on the public site until approved.
          </p>
          <div className="mt-3 space-y-2">
            {pendingFlyers.map((f) => (
              <div key={f.id} className="rounded-lg border border-amber-200 bg-white p-3">
                <p className="text-sm font-bold text-slate-900">{f.name}</p>
                <p className="mt-0.5 text-xs text-slate-600">{f.location || "No address given"}</p>
                {f.details && <p className="mt-1 text-xs text-slate-500">{f.details}</p>}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFlyerStatus(f.id, "active")}
                    className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    ✓ Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlyerStatus(f.id, "archived")}
                    className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={addAssignment} className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-700">Flyer</label>
          <select
            value={flyerId}
            onChange={(e) => setFlyerId(e.target.value)}
            className="mt-1 w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Choose a flyer…</option>
            {flyers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.event_date ? ` — ${f.event_date}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Board</label>
          <select
            value={board}
            onChange={(e) => setBoard(e.target.value as FlyerBoard)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="master">Board 1 — Master</option>
            <option value="weekly">Board 2 — This Week</option>
            <option value="today">Board 3 — Today</option>
          </select>
        </div>
        {board === "weekly" && (
          <div>
            <label className="block text-xs font-medium text-slate-700">Weekday</label>
            <select
              value={weekday}
              onChange={(e) => setWeekday(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {WEEKDAYS.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {board === "today" && (
          <div>
            <label className="block text-xs font-medium text-slate-700">Date</label>
            <input
              type="date"
              value={todayDate}
              onChange={(e) => setTodayDate(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-700">Category (optional)</label>
          <input
            type="text"
            placeholder="Seasonal Pick"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Status</label>
          <select
            value={rotStatus}
            onChange={(e) => setRotStatus(e.target.value as FlyerStatus)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Assign
        </button>
      </form>

      <div className="mt-6 space-y-2">
        {rotations.length === 0 && <p className="text-sm text-slate-500">No board assignments yet.</p>}
        {rotations.map((r) => {
          const flyer = flyerById.get(r.flyer_id);
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{flyer?.name ?? "(deleted flyer)"}</p>
                <p className="text-xs text-slate-500">
                  {BOARD_LABEL[r.assigned_board]}
                  {r.assigned_day ? ` — ${r.assigned_day}` : ""}
                  {r.category ? ` — ${r.category}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cycleAssignmentStatus(r)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    r.status === "active"
                      ? "bg-green-100 text-green-800"
                      : r.status === "draft"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {r.status}
                </button>
                <button type="button" onClick={() => removeAssignment(r.id)} className="text-xs font-semibold text-red-600 underline">
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-bold text-slate-900">All Flyers</h2>
        <p className="mt-1 text-sm text-slate-600">
          A flyer&apos;s own status controls whether it shows up anywhere on the public board at all.
        </p>
        <div className="mt-3 space-y-2">
          {flyers.map((f) => (
            <div key={f.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {f.flyer_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.flyer_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ objectPosition: `${f.flyer_focal_x}% ${f.flyer_focal_y}%` }}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xl text-slate-300">📌</span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[8px] font-semibold text-white">
                      {uploadingPhotoId === f.id ? "…" : f.flyer_image_url ? "Change" : "Upload"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPhotoId === f.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFlyerPhoto(f, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="truncate text-sm font-medium text-slate-900">
                    {f.name} <span className="text-xs font-normal text-slate-400">({f.type})</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => (editingFlyerId === f.id ? setEditingFlyerId(null) : startEditFlyer(f))}
                    className="rounded-full border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {editingFlyerId === f.id ? "✕ Close" : "📝 Edit Details"}
                  </button>
                  {f.flyer_image_url && (
                    <button
                      type="button"
                      onClick={() => setCroppingFlyer(f)}
                      className="rounded-full border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      ✏️ Crop
                    </button>
                  )}
                  <select
                    value={f.status}
                    onChange={(e) => setFlyerStatus(f.id, e.target.value as FlyerStatus)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {editingFlyerId === f.id && (
                <div className="mt-3 grid gap-4 border-t border-slate-100 pt-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-700">Date</label>
                        <input
                          type="date"
                          value={editForm.event_date}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, event_date: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-700">End date (optional)</label>
                        <input
                          type="date"
                          value={editForm.end_date}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, end_date: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Location</label>
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, location: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Description</label>
                      <textarea
                        rows={3}
                        value={editForm.details}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, details: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-700">Category</label>
                        <select
                          value={editForm.category_id}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, category_id: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">—</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icon ? `${c.icon} ` : ""}
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-700">Hosted / mentions vendor</label>
                        <select
                          value={editForm.hosting_vendor_id}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, hosting_vendor_id: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">— none —</option>
                          {hosts.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.business_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveFlyerEdit(f)}
                      disabled={savingEdit || !editForm.name.trim()}
                      className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-700">Preview — how this looks on the board</p>
                    <div className="mt-1 overflow-hidden rounded-xl border border-slate-200">
                      <div className="relative h-32 w-full bg-slate-100">
                        {f.flyer_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={f.flyer_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                            style={{ objectPosition: `${f.flyer_focal_x}% ${f.flyer_focal_y}%` }}
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-3xl text-slate-300">📌</span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-bold text-slate-900">{editForm.name || "(untitled)"}</p>
                        {editForm.event_date && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {new Date(editForm.event_date + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {editForm.end_date ? ` – ${new Date(editForm.end_date + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                          </p>
                        )}
                        {editForm.location && <p className="mt-0.5 text-xs text-slate-500">📍 {editForm.location}</p>}
                        {editForm.details && <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600">{editForm.details}</p>}
                        {editForm.hosting_vendor_id && (
                          <p className="mt-1.5 text-xs font-semibold text-slate-500">
                            Hosted at {hosts.find((h) => h.id === editForm.hosting_vendor_id)?.business_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {croppingFlyer && croppingFlyer.flyer_image_url && (
        <FlyerCropEditor
          flyerId={croppingFlyer.id}
          photoUrl={croppingFlyer.flyer_image_url}
          initialFocalX={croppingFlyer.flyer_focal_x}
          initialFocalY={croppingFlyer.flyer_focal_y}
          onClose={() => setCroppingFlyer(null)}
          onSaved={(x, y) => {
            setFlyers((prev) => prev.map((f) => (f.id === croppingFlyer.id ? { ...f, flyer_focal_x: x, flyer_focal_y: y } : f)));
            setCroppingFlyer(null);
          }}
        />
      )}
    </div>
  );
}
