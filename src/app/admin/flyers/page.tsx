"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import type { FlyerBoard, FlyerRotation, FlyerStatus, LovEntry } from "@/lib/types";

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

  async function loadAll() {
    const supabase = createClient();
    const [{ data: flyerRows }, { data: rotationRows }] = await Promise.all([
      supabase.from("lov_entries").select("*").order("event_date", { ascending: false }).returns<LovEntry[]>(),
      supabase.from("flyer_rotation").select("*").order("assigned_board").returns<FlyerRotation[]>(),
    ]);
    setFlyers(flyerRows ?? []);
    setRotations(rotationRows ?? []);
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

  if (status === "loading") {
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
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

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

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
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm font-medium text-slate-900">
                {f.name} <span className="text-xs font-normal text-slate-400">({f.type})</span>
              </p>
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
          ))}
        </div>
      </div>
    </div>
  );
}
