"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { CITY_CENTERS, nearestCityCenter } from "@/lib/geo";
import { formatPrice, type ActivityLog, type LovEntry, type PricingTier, type Vendor, type VendorStatusLog } from "@/lib/types";

type TimeBucket = "live" | "future" | "past";
type Kind = "vendor" | "event";
type ApprovalStatus = "approved" | "pending" | "rejected" | "suspended" | "draft";

const PENDING_TIMEOUT_DAYS = 7;

interface Item {
  id: string;
  kind: Kind;
  name: string;
  city: string;
  bucket: TimeBucket;
  approval: ApprovalStatus;
  badge: string | null;
  subtitle: string;
  dateLabel: string;
  sortDate: string;
  approvedAtLabel: string | null;
  timedOut: boolean;
  reapproved: boolean;
}

function vendorApproval(status: Vendor["status"]): ApprovalStatus {
  if (status === "active") return "approved";
  if (status === "pending") return "pending";
  if (status === "suspended") return "suspended";
  return "rejected";
}

function eventApproval(status: LovEntry["status"]): ApprovalStatus {
  if (status === "active") return "approved";
  if (status === "pending") return "pending";
  if (status === "draft") return "draft";
  return "rejected";
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cityForCoords(lat: number | null, lng: number | null, sectionZone?: string | null): string {
  if (sectionZone) {
    const bySection = CITY_CENTERS.find((c) => c.section === sectionZone);
    if (bySection) return bySection.city;
  }
  if (lat !== null && lng !== null) return nearestCityCenter(lat, lng).city;
  return "Unknown";
}

function vendorToItem(v: Vendor, tierName: string | null, reapprovedCount: number): Item {
  const bucket: TimeBucket = v.status === "active" ? "live" : v.status === "pending" ? "future" : "past";
  const badge = v.is_top10 ? "⭐ Top 10" : v.is_founding_vendor ? "🏆 Founding" : null;
  const pendingSince = v.onboarded_at ?? v.created_at;
  const timedOut =
    v.status === "pending" &&
    Date.now() - new Date(pendingSince).getTime() > PENDING_TIMEOUT_DAYS * 24 * 60 * 60 * 1000;
  return {
    id: v.id,
    kind: "vendor",
    name: v.business_name,
    city: cityForCoords(v.lat, v.lng),
    bucket,
    approval: vendorApproval(v.status),
    badge,
    subtitle: `${v.status}${tierName ? ` · ${tierName}` : ""}`,
    dateLabel: new Date(v.onboarded_at ?? v.created_at).toLocaleDateString("en-US"),
    sortDate: v.onboarded_at ?? v.created_at,
    approvedAtLabel: v.approved_at ? new Date(v.approved_at).toLocaleString("en-US") : null,
    timedOut,
    reapproved: reapprovedCount > 1,
  };
}

function eventToItem(e: LovEntry): Item {
  const today = todayKey();
  const start = e.event_date?.slice(0, 10) ?? null;
  const end = e.end_date?.slice(0, 10) ?? start;
  let bucket: TimeBucket = "live"; // recurring / no fixed date = ongoing
  if (start) {
    if (end && end < today) bucket = "past";
    else if (start > today) bucket = "future";
    else bucket = "live";
  }
  return {
    id: e.id,
    kind: "event",
    name: e.name,
    city: cityForCoords(e.lat, e.lng, e.section_zone),
    bucket,
    approval: eventApproval(e.status),
    badge: e.booth_tier === "top" ? "🏆 Top Booth" : null,
    subtitle: e.recurrence ?? e.location ?? "Event",
    dateLabel: start ? new Date(start).toLocaleDateString("en-US") : "Recurring",
    sortDate: start ?? "9999-99-99",
    approvedAtLabel: null,
    timedOut: false,
    reapproved: false,
  };
}

const BUCKET_LABEL: Record<TimeBucket, string> = { live: "Live / Now", future: "Future", past: "Past" };
const BUCKET_STYLE: Record<TimeBucket, string> = {
  live: "border-green-300 bg-green-50",
  future: "border-blue-300 bg-blue-50",
  past: "border-slate-300 bg-slate-50",
};
const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  suspended: "Suspended",
  draft: "Draft",
};
const APPROVAL_STYLE: Record<ApprovalStatus, string> = {
  approved: "bg-green-600 text-white",
  pending: "bg-amber-500 text-white",
  rejected: "bg-red-600 text-white",
  suspended: "bg-orange-500 text-white",
  draft: "bg-slate-400 text-white",
};

export default function LegacyDashboardPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [statusLog, setStatusLog] = useState<VendorStatusLog[]>([]);
  const [cityFilter, setCityFilter] = useState("All");
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [approvalFilter, setApprovalFilter] = useState<"all" | ApprovalStatus>("all");
  const [timedOutOnly, setTimedOutOnly] = useState(false);
  const [reapprovedOnly, setReapprovedOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const [{ data: vendorRows }, { data: eventRows }, { data: tierRows }, { data: logRows }] = await Promise.all([
        supabase.from("vendors").select("*").returns<Vendor[]>(),
        supabase.from("lov_entries").select("*").eq("type", "event").returns<LovEntry[]>(),
        supabase.from("pricing_tiers").select("*").returns<PricingTier[]>(),
        supabase.from("vendor_status_log").select("*").returns<VendorStatusLog[]>(),
      ]);
      if (cancelled) return;
      setVendors(vendorRows ?? []);
      setEvents(eventRows ?? []);
      setTiers(tierRows ?? []);
      setStatusLog(logRows ?? []);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);

  const approvalCountByVendor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of statusLog) {
      if (row.new_status !== "active") continue;
      counts.set(row.vendor_id, (counts.get(row.vendor_id) ?? 0) + 1);
    }
    return counts;
  }, [statusLog]);

  const items = useMemo<Item[]>(() => {
    const fromVendors = vendors.map((v) =>
      vendorToItem(v, v.tier_id ? (tierById.get(v.tier_id)?.name ?? null) : null, approvalCountByVendor.get(v.id) ?? 0),
    );
    const fromEvents = events.map(eventToItem);
    return [...fromVendors, ...fromEvents].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  }, [vendors, events, tierById, approvalCountByVendor]);

  const cities = useMemo(
    () => ["All", "Unknown", ...CITY_CENTERS.map((c) => c.city).filter((v, i, a) => a.indexOf(v) === i)],
    [],
  );

  const filtered = items.filter(
    (i) =>
      (cityFilter === "All" || i.city === cityFilter) &&
      (kindFilter === "all" || i.kind === kindFilter) &&
      (approvalFilter === "all" || i.approval === approvalFilter) &&
      (!timedOutOnly || i.timedOut) &&
      (!reapprovedOnly || i.reapproved),
  );

  const buckets: TimeBucket[] = ["live", "future", "past"];

  async function toggleExpand(item: Item) {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    setHistoryLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .eq("entity_type", item.kind === "vendor" ? "vendor" : "event")
      .eq("entity_id", item.id)
      .order("created_at", { ascending: false })
      .returns<ActivityLog[]>();
    setHistory(data ?? []);
    setHistoryLoading(false);
  }

  function downloadCsv() {
    const header = ["Name", "Type", "City", "Status", "Approval", "Approved At", "Timed Out", "Reapproved", "Badge", "Date"];
    const lines = filtered.map((i) =>
      [
        i.name,
        i.kind,
        i.city,
        BUCKET_LABEL[i.bucket],
        APPROVAL_LABEL[i.approval],
        i.approvedAtLabel ?? "",
        i.timedOut ? "Yes" : "",
        i.reapproved ? "Yes" : "",
        i.badge ?? "",
        i.dateLabel,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citypinned-legacy-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** A .doc file is just HTML with a Word-compatible MIME type and
   * extension - Word (desktop and mobile) opens it directly as a real
   * document, no docx-generation library needed for a static export. */
  function downloadWord() {
    const rows = filtered
      .map(
        (i) =>
          `<tr><td>${i.name}</td><td>${i.kind}</td><td>${i.city}</td><td>${BUCKET_LABEL[i.bucket]}</td><td>${APPROVAL_LABEL[i.approval]}</td><td>${i.approvedAtLabel ?? ""}</td><td>${i.timedOut ? "Yes" : ""}</td><td>${i.reapproved ? "Yes" : ""}</td><td>${i.badge ?? ""}</td><td>${i.dateLabel}</td></tr>`,
      )
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>CityPinned Inventory</title></head>
<body>
<h1>CityPinned — Full Inventory</h1>
<p>Generated ${new Date().toLocaleString("en-US")} — ${filtered.length} of ${items.length} total.</p>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;">
<thead><tr><th>Name</th><th>Type</th><th>City</th><th>Live Status</th><th>Approval</th><th>Approved At</th><th>Timed Out</th><th>Reapproved</th><th>Badge</th><th>Date</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citypinned-inventory-${new Date().toISOString().slice(0, 10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
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
    <div className="mx-auto max-w-6xl px-4 py-10 print:max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Legacy Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every vendor and event, one screen — tap any card for its full timestamped history.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex rounded-full border border-slate-300 p-1 text-sm font-semibold">
          {(["all", "vendor", "event"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={`rounded-full px-3 py-1 ${kindFilter === k ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              {k === "all" ? "All" : k === "vendor" ? "Vendors" : "Events"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ⬇️ Export CSV
        </button>
        <button
          type="button"
          onClick={downloadWord}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          📄 Export Word
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          🖨️ Print / Save as PDF
        </button>
        <span className="text-sm font-medium text-slate-500">{filtered.length} shown</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 print:hidden">
        {(["all", "approved", "pending", "rejected", "suspended", "draft"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setApprovalFilter(a)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              approvalFilter === a
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {a === "all" ? "All Approval States" : APPROVAL_LABEL[a]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTimedOutOnly((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            timedOutOnly ? "bg-amber-600 text-white" : "border border-amber-300 text-amber-700 hover:bg-amber-50"
          }`}
        >
          ⏱ Timed Out ({PENDING_TIMEOUT_DAYS}+ days pending)
        </button>
        <button
          type="button"
          onClick={() => setReapprovedOnly((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            reapprovedOnly ? "bg-indigo-600 text-white" : "border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          }`}
        >
          🔁 Reapproved
        </button>
      </div>

      {buckets.map((bucket) => {
        const bucketItems = filtered.filter((i) => i.bucket === bucket);
        if (!bucketItems.length) return null;
        return (
          <div key={bucket} className="mt-8 break-inside-avoid">
            <h2 className="text-lg font-bold text-slate-900">
              {BUCKET_LABEL[bucket]} <span className="text-sm font-normal text-slate-500">({bucketItems.length})</span>
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {bucketItems.map((item) => {
                const expanded = expandedId === item.id;
                return (
                  <div key={item.id} className="col-span-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(item)}
                      className={`w-full rounded-xl border p-3 text-left text-sm ${BUCKET_STYLE[item.bucket]} ${
                        expanded ? "ring-2 ring-slate-900" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate font-bold text-slate-900">
                          {item.kind === "vendor" ? "🏪" : "📅"} {item.name}
                        </p>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${APPROVAL_STYLE[item.approval]}`}>
                          {APPROVAL_LABEL[item.approval]}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-600">{item.city}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{item.subtitle}</p>
                      {item.badge && <p className="mt-1 text-xs font-semibold text-amber-700">{item.badge}</p>}
                      {item.approvedAtLabel && (
                        <p className="mt-0.5 text-[10px] text-green-700">✓ Approved {item.approvedAtLabel}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.timedOut && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                            ⏱ Timed Out
                          </span>
                        )}
                        {item.reapproved && (
                          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-800">
                            🔁 Reapproved
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">{item.dateLabel}</p>
                    </button>
                    {expanded && (
                      <div className="mt-1 rounded-xl border border-slate-200 bg-white p-3 text-xs print:hidden">
                        {historyLoading ? (
                          <p className="text-slate-400">Loading history…</p>
                        ) : history.length === 0 ? (
                          <p className="text-slate-400">No logged actions yet for this one.</p>
                        ) : (
                          <ul className="space-y-2">
                            {history.map((h) => (
                              <li key={h.id} className="border-l-2 border-slate-300 pl-2">
                                <p className="font-semibold text-slate-800">{h.action}</p>
                                {h.detail && <p className="text-slate-500">{h.detail}</p>}
                                <p className="text-[10px] text-slate-400">{new Date(h.created_at).toLocaleString("en-US")}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && <p className="mt-10 text-sm text-slate-500">Nothing matches this filter yet.</p>}

      {tierById.size > 0 && (
        <p className="mt-10 text-xs text-slate-400 print:hidden">
          Tier reference: {[...tierById.values()].map((t) => `${t.name} (${formatPrice(t.price_cents)})`).join(" · ")}
        </p>
      )}
    </div>
  );
}
