"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { CITY_CENTERS, nearestCityCenter } from "@/lib/geo";
import {
  formatPrice,
  type AdminNote,
  type AdminNoteRevision,
  type AdminNoteType,
  type LovEntry,
  type Registration,
  type RelationshipStatus,
  type Vendor,
  type VendorBoostBooking,
  type VendorStatusLog,
} from "@/lib/types";

interface ReportRow {
  id: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}

interface ActivityLogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  action: string;
  detail: string | null;
  created_at: string;
}

type EntityKind = "vendor" | "event";

function cityOfVendor(v: Vendor): string {
  if (v.lat === null || v.lng === null) return "Unknown";
  return nearestCityCenter(v.lat, v.lng).city;
}

function cityOfEvent(e: LovEntry): string {
  if (e.section_zone) {
    const bySection = CITY_CENTERS.find((c) => c.section === e.section_zone);
    if (bySection) return bySection.city;
  }
  if (e.lat !== null && e.lng !== null) return nearestCityCenter(e.lat, e.lng).city;
  return "Unknown";
}

function groupByCity<T>(rows: T[], cityOf: (row: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const city = cityOf(row);
    const list = map.get(city) ?? [];
    list.push(row);
    map.set(city, list);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const NOTE_TYPE_LABELS: Record<AdminNoteType, string> = {
  meeting: "🗓️ Meeting",
  followup: "🔁 Follow-up",
  partnership: "🤝 Partnership",
  conversation: "💬 Conversation",
  communication: "📞 Communication",
  context: "📌 Context",
};

const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = {
  contacted: "Contacted",
  interested: "Interested",
  onboarding: "Onboarding",
  active_vendor: "Active Vendor",
  inactive: "Inactive",
  needs_followup: "Needs Follow-up",
};

interface TimelineEntry {
  ts: string;
  icon: string;
  label: string;
  detail?: string | null;
}

function timelineToCsv(entityName: string, entries: TimelineEntry[]): string {
  const header = ["Date", "Event", "Detail"];
  const lines = entries.map((e) =>
    [new Date(e.ts).toLocaleString("en-US"), e.label, e.detail ?? ""].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
  );
  return [`"${entityName} — Activity Timeline"`, header.join(","), ...lines].join("\n");
}

export default function AdminHistoryPage() {
  return (
    <Suspense fallback={null}>
      <AdminHistoryContent />
    </Suspense>
  );
}

function AdminHistoryContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [adminEmail, setAdminEmail] = useState<string>("admin");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [entityType, setEntityType] = useState<EntityKind>(searchParams.get("type") === "event" ? "event" : "vendor");
  const [entityId, setEntityId] = useState(searchParams.get("id") ?? "");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setAdminEmail(user?.email ?? "admin");
      const [{ data: vendorRows }, { data: eventRows }] = await Promise.all([
        supabase.from("vendors").select("*").order("business_name").returns<Vendor[]>(),
        supabase.from("lov_entries").select("*").eq("type", "event").order("name").returns<LovEntry[]>(),
      ]);
      if (cancelled) return;
      setVendors(vendorRows ?? []);
      setEvents(eventRows ?? []);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => v.business_name.toLowerCase().includes(q) || v.contact_email.toLowerCase().includes(q));
  }, [vendors, search]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => e.name.toLowerCase().includes(q));
  }, [events, search]);

  const groupedVendorsByCity = useMemo(() => groupByCity(filteredVendors, cityOfVendor), [filteredVendors]);
  const groupedEventsByCity = useMemo(() => groupByCity(filteredEvents, cityOfEvent), [filteredEvents]);

  const selectedVendor = entityType === "vendor" ? vendors.find((v) => v.id === entityId) : undefined;
  const selectedEvent = entityType === "event" ? events.find((e) => e.id === entityId) : undefined;
  const selectedName = selectedVendor?.business_name ?? selectedEvent?.name ?? null;

  if (status === "loading") {
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">🗂️ Notes &amp; History</h1>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Private notes, follow-up tracking, and a full timeline — one account or event at a time. Nothing here is
        visible to vendors or the public.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEntityType("vendor");
              setEntityId("");
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              entityType === "vendor" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600"
            }`}
          >
            Vendors / Accounts / Hosts
          </button>
          <button
            type="button"
            onClick={() => {
              setEntityType("event");
              setEntityId("");
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              entityType === "event" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600"
            }`}
          >
            Events
          </button>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={entityType === "vendor" ? "Search vendors…" : "Search events…"}
            className="ml-auto w-56 rounded-full border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>

        {!entityId && (
          <div className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
            {entityType === "vendor"
              ? groupedVendorsByCity.map(([city, cityVendors]) => (
                  <div key={city}>
                    <p className="sticky top-0 bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {city} <span className="font-normal normal-case">({cityVendors.length})</span>
                    </p>
                    {cityVendors.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setEntityId(v.id)}
                        className="block w-full border-t border-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">{v.business_name}</span>{" "}
                        <span className="text-xs text-slate-400">{v.contact_email}</span>
                      </button>
                    ))}
                  </div>
                ))
              : groupedEventsByCity.map(([city, cityEvents]) => (
                  <div key={city}>
                    <p className="sticky top-0 bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {city} <span className="font-normal normal-case">({cityEvents.length})</span>
                    </p>
                    {cityEvents.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setEntityId(e.id)}
                        className="block w-full border-t border-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">{e.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
            {entityType === "vendor" && filteredVendors.length === 0 && <p className="px-3 py-4 text-sm text-slate-400">No matches.</p>}
            {entityType === "event" && filteredEvents.length === 0 && <p className="px-3 py-4 text-sm text-slate-400">No matches.</p>}
          </div>
        )}
      </div>

      {entityId && selectedName && (
        <EntityDetail
          key={`${entityType}:${entityId}`}
          entityType={entityType}
          entityId={entityId}
          entityName={selectedName}
          vendor={selectedVendor}
          event={selectedEvent}
          adminEmail={adminEmail}
          onVendorUpdated={(patch) => setVendors((prev) => prev.map((v) => (v.id === entityId ? { ...v, ...patch } : v)))}
          onBack={() => setEntityId("")}
        />
      )}
    </div>
  );
}

function EntityDetail({
  entityType,
  entityId,
  entityName,
  vendor,
  event,
  adminEmail,
  onVendorUpdated,
  onBack,
}: {
  entityType: EntityKind;
  entityId: string;
  entityName: string;
  vendor?: Vendor;
  event?: LovEntry;
  adminEmail: string;
  onVendorUpdated: (patch: Partial<Vendor>) => void;
  onBack: () => void;
}) {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [revisionsByNote, setRevisionsByNote] = useState<Record<string, AdminNoteRevision[]>>({});
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [newNoteType, setNewNoteType] = useState<AdminNoteType>("context");
  const [newNoteBody, setNewNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }

  async function loadNotes() {
    const supabase = createClient();
    const { data } = await supabase
      .from("admin_notes")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .returns<AdminNote[]>();
    setNotes(data ?? []);
  }

  async function loadTimeline() {
    setLoadingTimeline(true);
    const supabase = createClient();
    const entries: TimelineEntry[] = [];

    const [{ data: activityRows }, { data: reportRows }, { data: noteRows }] = await Promise.all([
      supabase.from("activity_log").select("*").eq("entity_type", entityType).eq("entity_id", entityId).returns<ActivityLogRow[]>(),
      supabase.from("reports").select("*").eq("target_id", entityId).returns<ReportRow[]>(),
      supabase.from("admin_notes").select("*").eq("entity_type", entityType).eq("entity_id", entityId).returns<AdminNote[]>(),
    ]);

    (activityRows ?? []).forEach((r) => entries.push({ ts: r.created_at, icon: "⚙️", label: r.action, detail: r.detail }));
    (reportRows ?? []).forEach((r) => entries.push({ ts: r.created_at, icon: "🚩", label: `Request/Report: ${r.reason}`, detail: r.details }));
    (noteRows ?? []).forEach((n) =>
      entries.push({ ts: n.created_at, icon: "📝", label: `Note added — ${NOTE_TYPE_LABELS[n.note_type]}`, detail: n.body.slice(0, 120) }),
    );

    if (entityType === "vendor") {
      entries.push({ ts: vendor?.created_at ?? new Date().toISOString(), icon: "🆕", label: "Account created" });

      const [{ data: statusRows }, { data: regRows }, { data: boostRows }, { data: listingRows }] = await Promise.all([
        supabase.from("vendor_status_log").select("*").eq("vendor_id", entityId).returns<VendorStatusLog[]>(),
        supabase.from("registrations").select("*").eq("claimed_by_vendor_id", entityId).returns<Registration[]>(),
        supabase.from("vendor_boost_bookings").select("*").eq("vendor_id", entityId).returns<VendorBoostBooking[]>(),
        supabase.from("lov_entries").select("id,name,type,created_at").eq("vendor_id", entityId).returns<Pick<LovEntry, "id" | "name" | "type" | "created_at">[]>(),
      ]);
      (statusRows ?? []).forEach((r) =>
        entries.push({ ts: r.changed_at, icon: "✅", label: `Status → ${r.new_status}`, detail: r.old_status ? `was ${r.old_status}` : undefined }),
      );
      (regRows ?? []).forEach((r) =>
        entries.push({
          ts: r.created_at,
          icon: "💳",
          label: `Payment ${r.status} — ${formatPrice(r.amount_cents)}`,
          detail: r.paid_at ? `paid ${new Date(r.paid_at).toLocaleString("en-US")}` : undefined,
        }),
      );
      (boostRows ?? []).forEach((r) => entries.push({ ts: r.created_at, icon: "🚀", label: "Boost purchased/granted", detail: `slot ${new Date(r.slot_start).toLocaleString("en-US")}` }));
      (listingRows ?? []).forEach((r) => entries.push({ ts: r.created_at, icon: "📌", label: `Created ${r.type}: ${r.name}` }));
    } else if (event) {
      entries.push({ ts: event.created_at, icon: "🆕", label: "Event/flyer created" });
      if (event.publish_at) entries.push({ ts: event.publish_at, icon: "📢", label: "Scheduled to publish" });
    }

    entries.sort((a, b) => b.ts.localeCompare(a.ts));
    setTimeline(entries);
    setLoadingTimeline(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount for the selected entity; the component remounts (key={entityType:entityId}) on every entity change, so this only ever runs once per real navigation, not a render-cascade
    loadNotes();
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function addNote() {
    if (!newNoteBody.trim()) return;
    setSavingNote(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("admin_notes").insert({
      entity_type: entityType,
      entity_id: entityId,
      note_type: newNoteType,
      body: newNoteBody.trim(),
      created_by_email: adminEmail,
    });
    setSavingNote(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewNoteBody("");
    await loadNotes();
    await loadTimeline();
    flash("✓ Note added");
  }

  async function loadRevisions(noteId: string) {
    if (revisionsByNote[noteId]) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("admin_note_revisions")
      .select("*")
      .eq("note_id", noteId)
      .order("edited_at", { ascending: false })
      .returns<AdminNoteRevision[]>();
    setRevisionsByNote((prev) => ({ ...prev, [noteId]: data ?? [] }));
  }

  function startEdit(note: AdminNote) {
    setEditingNoteId(note.id);
    setEditBody(note.body);
  }

  async function saveEdit(note: AdminNote) {
    if (!editBody.trim() || editBody === note.body) {
      setEditingNoteId(null);
      return;
    }
    setError(null);
    const supabase = createClient();
    // Preserve history: archive the old body before overwriting it.
    const { error: revisionError } = await supabase
      .from("admin_note_revisions")
      .insert({ note_id: note.id, previous_body: note.body, edited_by_email: adminEmail });
    if (revisionError) {
      setError(revisionError.message);
      return;
    }
    const { error: updateError } = await supabase
      .from("admin_notes")
      .update({ body: editBody.trim(), updated_at: new Date().toISOString(), updated_by_email: adminEmail })
      .eq("id", note.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingNoteId(null);
    setRevisionsByNote((prev) => {
      const next = { ...prev };
      delete next[note.id];
      return next;
    });
    await loadNotes();
    flash("✓ Note updated");
  }

  async function saveCrmField(patch: Partial<Vendor>) {
    if (!vendor) return;
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("vendors").update(patch).eq("id", vendor.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onVendorUpdated(patch);
    flash("✓ Updated");
  }

  return (
    <div className="mt-6 space-y-6 print:max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-900">{entityName}</h2>
        <div className="flex items-center gap-3 print:hidden">
          <button
            type="button"
            onClick={() => {
              const csv = timelineToCsv(entityName, timeline);
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `citypinned-history-${entityName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ⬇️ Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            🖨️ Print / Save as PDF
          </button>
          <button type="button" onClick={onBack} className="text-xs font-semibold text-slate-500 underline">
            ← Choose different {entityType}
          </button>
        </div>
      </div>

      {/* CRM / RELATIONSHIP TRACKING (vendors only) */}
      {vendor && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-sky-800">Relationship Tracking</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Relationship status</label>
              <select
                value={vendor.relationship_status ?? ""}
                onChange={(e) => saveCrmField({ relationship_status: (e.target.value || null) as RelationshipStatus | null })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                {(Object.keys(RELATIONSHIP_LABELS) as RelationshipStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {RELATIONSHIP_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Last contact date</label>
              <input
                type="date"
                value={vendor.last_contact_date ?? ""}
                onChange={(e) => saveCrmField({ last_contact_date: e.target.value || null })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Next follow-up date</label>
              <input
                type="date"
                value={vendor.next_followup_date ?? ""}
                onChange={(e) => saveCrmField({ next_followup_date: e.target.value || null })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        </section>
      )}

      {/* INTERNAL NOTES */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-amber-800">Internal Notes</h3>
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-amber-200 bg-white p-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Type</label>
            <select value={newNoteType} onChange={(e) => setNewNoteType(e.target.value as AdminNoteType)} className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              {(Object.keys(NOTE_TYPE_LABELS) as AdminNoteType[]).map((k) => (
                <option key={k} value={k}>
                  {NOTE_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={newNoteBody}
            onChange={(e) => setNewNoteBody(e.target.value)}
            placeholder="Write a note…"
            rows={2}
            className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={addNote}
            disabled={savingNote || !newNoteBody.trim()}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {savingNote ? "Saving…" : "Add Note"}
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        {toast && <p role="status" aria-live="polite" className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{toast}</p>}

        <div className="mt-4 space-y-3">
          {notes.length === 0 && <p className="text-sm text-slate-500">No notes yet.</p>}
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-amber-200 bg-white p-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-amber-700">{NOTE_TYPE_LABELS[note.note_type]}</span>
                <span>
                  {note.created_by_email} · {new Date(note.created_at).toLocaleString("en-US")}
                  {note.updated_by_email && <span> · edited by {note.updated_by_email}</span>}
                </span>
              </div>
              {editingNoteId === note.id ? (
                <div className="mt-2">
                  <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                  <div className="mt-1 flex gap-2">
                    <button type="button" onClick={() => saveEdit(note)} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingNoteId(null)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{note.body}</p>
              )}
              <div className="mt-2 flex gap-3 text-xs">
                <button type="button" onClick={() => startEdit(note)} className="font-semibold text-slate-500 underline">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedNoteId(expandedNoteId === note.id ? null : note.id);
                    loadRevisions(note.id);
                  }}
                  className="font-semibold text-slate-500 underline"
                >
                  {expandedNoteId === note.id ? "Hide history" : "View history"}
                </button>
              </div>
              {expandedNoteId === note.id && (
                <div className="mt-2 space-y-2 border-t border-amber-100 pt-2">
                  {(revisionsByNote[note.id] ?? []).length === 0 ? (
                    <p className="text-xs text-slate-400">No prior edits.</p>
                  ) : (
                    revisionsByNote[note.id].map((rev) => (
                      <div key={rev.id} className="text-xs text-slate-500">
                        <span className="font-semibold">{rev.edited_by_email}</span> · {new Date(rev.edited_at).toLocaleString("en-US")}
                        <p className="mt-0.5 whitespace-pre-wrap text-slate-600">{rev.previous_body}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ACTIVITY TIMELINE */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Activity Timeline</h3>
        {loadingTimeline ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : timeline.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing recorded yet.</p>
        ) : (
          <ol className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
            {timeline.map((entry, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[22px] top-0.5">{entry.icon}</span>
                <p className="text-sm font-medium text-slate-900">{entry.label}</p>
                {entry.detail && <p className="text-xs text-slate-500">{entry.detail}</p>}
                <p className="text-[11px] text-slate-400">{new Date(entry.ts).toLocaleString("en-US")}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
