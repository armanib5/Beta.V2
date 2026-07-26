/* Owner Admin — gated by Supabase Auth (one admin account, created
   per supabase/README.md step 4). Tab bodies query Supabase directly;
   RLS (supabase/schema.sql) is what actually enforces that only a
   signed-in user can approve/reject/edit — this file doesn't need to
   duplicate that logic client-side. */

function init() {
  var gate = document.getElementById("sbGate");
  if (!isSupabaseConfigured()) {
    renderSupabaseNotConfigured(gate, "The admin dashboard");
    return;
  }
  var sb = getSupabase();
  sb.auth.getSession().then(function (res) {
    if (res.data.session) showDash(res.data.session);
    else showLogin();
  });
  sb.auth.onAuthStateChange(function (event, session) {
    if (session) showDash(session); else showLogin();
  });

  document.getElementById("loginBtn").onclick = function () {
    var email = document.getElementById("loginEmail").value.trim();
    var pass = document.getElementById("loginPass").value;
    var err = document.getElementById("loginErr");
    err.style.display = "none";
    sb.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
      if (res.error) { err.textContent = res.error.message; err.style.display = "block"; }
    });
  };
  document.getElementById("signOutBtn").onclick = function (e) {
    e.preventDefault();
    sb.auth.signOut();
  };

  document.querySelectorAll(".tabbtn").forEach(function (btn) {
    btn.onclick = function () {
      document.querySelectorAll(".tabbtn").forEach(function (b) { b.classList.remove("on"); });
      btn.classList.add("on");
      activeTab = btn.dataset.tab;
      renderTab(activeTab);
    };
  });

  /* Live event days mean new vendors/pins show up faster than anyone
     will remember to hit refresh - auto-recheck the tabs where that
     actually matters. Cities/Hours/Reports have free-typing inputs or
     change rarely, so leaving those to manual refresh avoids wiping
     someone's in-progress edit out from under them. */
  setInterval(function () {
    if (["vendors", "pins", "bookings"].indexOf(activeTab) === -1) return;
    renderTab(activeTab);
  }, 20000);
}
var activeTab = "vendors";

function showLogin() {
  document.getElementById("loginWrap").style.display = "block";
  document.getElementById("dashWrap").style.display = "none";
}
function showDash(session) {
  document.getElementById("loginWrap").style.display = "none";
  document.getElementById("dashWrap").style.display = "block";
  document.getElementById("whoami").textContent = session.user.email;
  renderTab("vendors");
}

function renderTab(tab) {
  var el = document.getElementById("tabContent");
  el.innerHTML = "<p class='aempty'>Loading&hellip;</p>";
  if (tab === "vendors") renderVendorsTab(el);
  else if (tab === "bookings") renderBookingsTab(el);
  else if (tab === "pins") renderPinsTab(el);
  else if (tab === "cities") renderCitiesTab(el);
  else if (tab === "hours") renderHoursTab(el);
  else if (tab === "reports") renderReportsTab(el);
}

/* Reports come from the Board's "Report" button on flyers/vendors -
   see supabase/migration_reports.sql, which needs to be run once before
   this table exists. Reports table only lets an authenticated user
   read/update rows, so this is the only place they're ever visible. */
var reportsFilter = "new";
function renderReportsTab(el) {
  var sb = getSupabase();
  sb.from("reports").select("*").order("created_at", { ascending: false }).then(function (res) {
    if (res.error) {
      el.innerHTML = "<p class='aempty'>" + res.error.message + " - have you run supabase/migration_reports.sql yet?</p>";
      return;
    }
    el.innerHTML = "";
    el.appendChild(statusFilterBarGeneric(reportsFilter, ["new", "reviewed", "dismissed", "all"], function (s) { reportsFilter = s; renderReportsTab(el); }));
    var rows = reportsFilter === "all" ? res.data : res.data.filter(function (r) { return r.status === reportsFilter; });
    if (!rows.length) { var p = document.createElement("p"); p.className = "aempty"; p.textContent = "No " + (reportsFilter === "all" ? "" : reportsFilter + " ") + "reports."; el.appendChild(p); return; }
    rows.forEach(function (r) {
      var row = document.createElement("div"); row.className = "eventcard"; row.style.alignItems = "flex-start"; row.style.flexDirection = "column";
      row.innerHTML = "<span class='etitle'>" + (r.target_type === "vendor" ? "Vendor: " : "Event: ") + (r.target_name || r.target_id) +
        " <span style='opacity:.6;font-size:11px;'>(" + r.reason + " &middot; " + new Date(r.created_at).toLocaleString() + ")</span></span>" +
        "<p style='font-size:12.5px;margin:6px 0;color:#fff;'>" + r.details + "</p>";
      if (r.status !== "reviewed") {
        var reviewedBtn = document.createElement("button"); reviewedBtn.className = "abtn green"; reviewedBtn.textContent = "Mark Reviewed";
        reviewedBtn.onclick = function () { sb.from("reports").update({ status: "reviewed" }).eq("id", r.id).then(function (res2) { if (res2.error) { alert(res2.error.message); return; } renderReportsTab(el); }); };
        row.appendChild(reviewedBtn);
      }
      if (r.status !== "dismissed") {
        var dismissBtn = document.createElement("button"); dismissBtn.className = "abtn gray"; dismissBtn.textContent = "Dismiss";
        dismissBtn.onclick = function () { sb.from("reports").update({ status: "dismissed" }).eq("id", r.id).then(function (res2) { if (res2.error) { alert(res2.error.message); return; } renderReportsTab(el); }); };
        row.appendChild(dismissBtn);
      }
      el.appendChild(row);
    });
  });
}

function timeAgo(iso) {
  if (!iso) return "";
  var sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return Math.floor(sec / 60) + "m ago";
  if (sec < 86400) return Math.floor(sec / 3600) + "h ago";
  return new Date(iso).toLocaleDateString();
}
function lastCheckedNote(el) {
  var note = document.createElement("div");
  note.style.cssText = "font-size:11px;opacity:.55;margin-bottom:10px;";
  note.textContent = "Auto-refreshing every 20s - last checked " + new Date().toLocaleTimeString();
  el.appendChild(note);
}

function statusFilterBarGeneric(current, options, onChange) {
  var bar = document.createElement("div"); bar.className = "tabrow"; bar.style.cssText = "margin:0 0 12px;padding:0;";
  options.forEach(function (s) {
    var b = document.createElement("button");
    b.className = "tabbtn" + (s === current ? " on" : "");
    b.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    b.onclick = function () { onChange(s); };
    bar.appendChild(b);
  });
  return bar;
}

/* Approve/reject used to fail silently on any error (RLS denial, network
   hiccup, session expired) - the row would just sit there with no
   feedback, looking like the button "didn't work". Every write below now
   surfaces res.error via alert() instead of swallowing it. */
var vendorsFilter = "pending", pinsFilter = "pending";

function statusFilterBar(current, onChange) {
  return statusFilterBarGeneric(current, ["pending", "approved", "rejected", "all"], onChange);
}

function renderVendorsTab(el) {
  var sb = getSupabase();
  sb.from("vendors").select("*").order("created_at", { ascending: false }).then(function (res) {
    if (res.error) { el.innerHTML = "<p class='aempty'>" + res.error.message + "</p>"; return; }
    el.innerHTML = "";
    lastCheckedNote(el);
    el.appendChild(statusFilterBar(vendorsFilter, function (s) { vendorsFilter = s; renderVendorsTab(el); }));
    var rows = vendorsFilter === "all" ? res.data : res.data.filter(function (v) { return v.status === vendorsFilter; });
    if (vendorsFilter === "pending" && rows.length > 1) {
      var approveAllBtn = document.createElement("button"); approveAllBtn.className = "abtn gold"; approveAllBtn.style.marginBottom = "10px";
      approveAllBtn.textContent = "Approve All (" + rows.length + ")";
      approveAllBtn.onclick = function () {
        if (!confirm("Approve all " + rows.length + " pending vendors?")) return;
        var ids = rows.map(function (v) { return v.id; });
        sb.from("vendors").update({ status: "approved" }).in("id", ids).then(function (r) {
          if (r.error) { alert("Couldn't approve all: " + r.error.message); return; }
          renderVendorsTab(el);
        });
      };
      el.appendChild(approveAllBtn);
    }
    if (!rows.length) { el.appendChild(document.createTextNode("")); var p = document.createElement("p"); p.className = "aempty"; p.textContent = "No " + (vendorsFilter === "all" ? "" : vendorsFilter + " ") + "vendors."; el.appendChild(p); return; }
    rows.forEach(function (v) {
      var row = document.createElement("div"); row.className = "eventcard";
      row.innerHTML = "<span class='etitle'>" + v.name + " <span style='opacity:.6;font-size:11px;'>(" + v.status + " &middot; added " + timeAgo(v.created_at) + ")</span></span>";
      if (v.status !== "approved") {
        var approveBtn = document.createElement("button"); approveBtn.className = "abtn green"; approveBtn.textContent = "Approve";
        approveBtn.onclick = function () { sb.from("vendors").update({ status: "approved" }).eq("id", v.id).then(function (r) { if (r.error) { alert("Couldn't approve: " + r.error.message); return; } renderVendorsTab(el); }); };
        row.appendChild(approveBtn);
      }
      if (v.status !== "rejected") {
        var rejectBtn = document.createElement("button"); rejectBtn.className = "abtn red"; rejectBtn.textContent = "Reject";
        rejectBtn.onclick = function () { sb.from("vendors").update({ status: "rejected" }).eq("id", v.id).then(function (r) { if (r.error) { alert("Couldn't reject: " + r.error.message); return; } renderVendorsTab(el); }); };
        row.appendChild(rejectBtn);
      }
      el.appendChild(row);
    });
  });
}

function renderPinsTab(el) {
  var sb = getSupabase();
  sb.from("pins").select("*").order("created_at", { ascending: false }).then(function (res) {
    if (res.error) { el.innerHTML = "<p class='aempty'>" + res.error.message + "</p>"; return; }
    el.innerHTML = "";
    lastCheckedNote(el);
    el.appendChild(statusFilterBar(pinsFilter, function (s) { pinsFilter = s; renderPinsTab(el); }));
    var rows = pinsFilter === "all" ? res.data : res.data.filter(function (p) { return p.status === pinsFilter; });
    if (pinsFilter === "pending" && rows.length > 1) {
      var approveAllBtn = document.createElement("button"); approveAllBtn.className = "abtn gold"; approveAllBtn.style.marginBottom = "10px";
      approveAllBtn.textContent = "Approve All (" + rows.length + ")";
      approveAllBtn.onclick = function () {
        if (!confirm("Approve all " + rows.length + " pending pins?")) return;
        var ids = rows.map(function (p) { return p.id; });
        sb.from("pins").update({ status: "approved" }).in("id", ids).then(function (r) {
          if (r.error) { alert("Couldn't approve all: " + r.error.message); return; }
          renderPinsTab(el);
        });
      };
      el.appendChild(approveAllBtn);
    }
    if (!rows.length) { var p2 = document.createElement("p"); p2.className = "aempty"; p2.textContent = "No " + (pinsFilter === "all" ? "" : pinsFilter + " ") + "pins."; el.appendChild(p2); return; }
    rows.forEach(function (p) {
      var row = document.createElement("div"); row.className = "eventcard";
      row.innerHTML = "<span class='etitle'>" + (p.title || "Untitled pin") + " &middot; " + p.owner_name +
        " <span style='opacity:.6;font-size:11px;'>(" + p.source + " / " + p.status + " &middot; added " + timeAgo(p.created_at) + ")</span></span>";
      if (p.status !== "approved") {
        var approveBtn = document.createElement("button"); approveBtn.className = "abtn green"; approveBtn.textContent = "Approve";
        approveBtn.onclick = function () { sb.from("pins").update({ status: "approved" }).eq("id", p.id).then(function (r) { if (r.error) { alert("Couldn't approve: " + r.error.message); return; } renderPinsTab(el); }); };
        row.appendChild(approveBtn);
      }
      if (p.status !== "rejected") {
        var rejectBtn = document.createElement("button"); rejectBtn.className = "abtn red"; rejectBtn.textContent = "Reject";
        rejectBtn.onclick = function () { sb.from("pins").update({ status: "rejected" }).eq("id", p.id).then(function (r) { if (r.error) { alert("Couldn't reject: " + r.error.message); return; } renderPinsTab(el); }); };
        row.appendChild(rejectBtn);
      }
      el.appendChild(row);
    });
  });
}

function renderBookingsTab(el) {
  var sb = getSupabase();
  sb.from("promo_bookings").select("*, vendors(name), events(title)").order("purchased_at", { ascending: false }).then(function (res) {
    if (res.error) { el.innerHTML = "<p class='aempty'>" + res.error.message + "</p>"; return; }
    if (!res.data.length) { el.innerHTML = "<p class='aempty'>No bookings yet.</p>"; return; }
    el.innerHTML = "";
    lastCheckedNote(el);
    res.data.forEach(function (b) {
      var row = document.createElement("div"); row.className = "eventcard";
      row.innerHTML = "<span class='etitle'>" + (b.vendors ? b.vendors.name : "?") + " &middot; " + (b.events ? b.events.title : "?") +
        " <span style='opacity:.6;font-size:11px;'>(" + b.type + " &middot; $" + b.amount + " &middot; " + b.status + " &middot; " + timeAgo(b.purchased_at) + ")</span></span>";
      if (b.status !== "cancelled") {
        var cancelBtn = document.createElement("button"); cancelBtn.className = "abtn red"; cancelBtn.textContent = "Cancel";
        cancelBtn.onclick = function () {
          if (!confirm("Cancel this booking?")) return;
          sb.from("promo_bookings").update({ status: "cancelled" }).eq("id", b.id).then(function () { renderBookingsTab(el); });
        };
        row.appendChild(cancelBtn);
      }
      el.appendChild(row);
    });
  });
}

/* Cities/Neighborhoods management - replaces the old Pricing tab, which
   edited a Supabase promo_pricing row that nothing on the live Board
   actually reads (Board's real Boost/Featured prices live in its own
   local storage, set from its own admin panel) - actual prices are
   untouched by this change. cities/neighborhoods are real Supabase
   tables with full RLS already in place; this is their first UI. */
function renderCitiesTab(el) {
  var sb = getSupabase();
  Promise.all([
    sb.from("cities").select("*").order("label"),
    sb.from("neighborhoods").select("*").order("label")
  ]).then(function (results) {
    var citiesRes = results[0], hoodsRes = results[1];
    if (citiesRes.error) { el.innerHTML = "<p class='aempty'>" + citiesRes.error.message + "</p>"; return; }
    if (hoodsRes.error) { el.innerHTML = "<p class='aempty'>" + hoodsRes.error.message + "</p>"; return; }
    var cities = citiesRes.data, hoods = hoodsRes.data;
    el.innerHTML = "";

    var addCityWrap = document.createElement("div"); addCityWrap.className = "adminhint";
    addCityWrap.innerHTML = "<div class='formgrid'>" +
      "<label>New city ID<input id='newCityId' placeholder='e.g. oak'></label>" +
      "<label>New city name<input id='newCityLabel' placeholder='e.g. Oakland'></label>" +
      "</div><button class='abtn gold' id='addCityBtn' style='margin-top:10px;'>+ Add City</button>";
    el.appendChild(addCityWrap);
    document.getElementById("addCityBtn").onclick = function () {
      var id = document.getElementById("newCityId").value.trim();
      var label = document.getElementById("newCityLabel").value.trim();
      if (!id || !label) { alert("Enter both an ID and a name."); return; }
      sb.from("cities").insert({ id: id, label: label }).then(function (r) { if (r.error) { alert(r.error.message); return; } renderCitiesTab(el); });
    };

    if (!cities.length) { var p = document.createElement("p"); p.className = "aempty"; p.textContent = "No cities yet."; el.appendChild(p); return; }

    cities.forEach(function (c) {
      var block = document.createElement("div"); block.className = "eventcard"; block.style.cssText = "flex-direction:column;align-items:stretch;margin-bottom:14px;";

      var head = document.createElement("div"); head.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap;";
      var title = document.createElement("span"); title.className = "etitle"; title.textContent = c.label + " (" + c.id + ")";
      var renameBtn = document.createElement("button"); renameBtn.className = "abtn gray"; renameBtn.textContent = "Rename";
      renameBtn.onclick = function () {
        var newLabel = prompt("New name for " + c.id + ":", c.label);
        if (!newLabel) return;
        sb.from("cities").update({ label: newLabel }).eq("id", c.id).then(function (r) { if (r.error) { alert(r.error.message); return; } renderCitiesTab(el); });
      };
      var delCityBtn = document.createElement("button"); delCityBtn.className = "abtn red"; delCityBtn.textContent = "Delete City";
      delCityBtn.onclick = function () {
        if (!confirm("Delete " + c.label + " and all its neighborhoods? This can't be undone.")) return;
        sb.from("cities").delete().eq("id", c.id).then(function (r) { if (r.error) { alert(r.error.message); return; } renderCitiesTab(el); });
      };
      head.appendChild(title); head.appendChild(renameBtn); head.appendChild(delCityBtn);
      block.appendChild(head);

      hoods.filter(function (h) { return h.city_id === c.id; }).forEach(function (h) {
        var hrow = document.createElement("div");
        hrow.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0 6px 16px;font-size:12.5px;color:rgba(218,184,112,.8);";
        var hlabel = document.createElement("span"); hlabel.style.flex = "1"; hlabel.style.minWidth = "120px"; hlabel.textContent = h.label + " (" + h.id + ")";
        var delHoodBtn = document.createElement("button"); delHoodBtn.className = "abtn red"; delHoodBtn.textContent = "Delete";
        delHoodBtn.onclick = function () {
          if (!confirm("Delete neighborhood " + h.label + "?")) return;
          sb.from("neighborhoods").delete().eq("id", h.id).then(function (r) { if (r.error) { alert(r.error.message); return; } renderCitiesTab(el); });
        };
        hrow.appendChild(hlabel); hrow.appendChild(delHoodBtn);
        block.appendChild(hrow);
      });

      var addHoodWrap = document.createElement("div"); addHoodWrap.style.cssText = "margin:10px 0 0 16px;";
      addHoodWrap.innerHTML = "<div class='formgrid'>" +
        "<label>New neighborhood ID<input id='newHoodId-" + c.id + "'></label>" +
        "<label>Name<input id='newHoodLabel-" + c.id + "'></label>" +
        "</div><button class='abtn gold' id='addHoodBtn-" + c.id + "' style='margin-top:8px;'>+ Add Neighborhood</button>";
      block.appendChild(addHoodWrap);
      addHoodWrap.querySelector("button").onclick = function () {
        var hid = document.getElementById("newHoodId-" + c.id).value.trim();
        var hlabel = document.getElementById("newHoodLabel-" + c.id).value.trim();
        if (!hid || !hlabel) { alert("Enter both an ID and a name."); return; }
        sb.from("neighborhoods").insert({ id: hid, city_id: c.id, label: hlabel }).then(function (r) { if (r.error) { alert(r.error.message); return; } renderCitiesTab(el); });
      };

      el.appendChild(block);
    });
  });
}

function renderHoursTab(el) {
  var sb = getSupabase();
  sb.from("events").select("id, title").order("title").then(function (res) {
    if (res.error) { el.innerHTML = "<p class='aempty'>" + res.error.message + "</p>"; return; }
    if (!res.data.length) { el.innerHTML = "<p class='aempty'>No events yet.</p>"; return; }
    var opts = res.data.map(function (e) { return "<option value='" + e.id + "'>" + e.title + "</option>"; }).join("");
    el.innerHTML = "<div class='formgrid'><label>Event<select id='hoursEventSel'>" + opts + "</select></label></div><div id='hoursGridWrap'></div>";
    var sel = document.getElementById("hoursEventSel");
    function draw() {
      var eventId = sel.value;
      sb.from("events").select("start_hour, end_hour").eq("id", eventId).single().then(function (evRes) {
        var sh = Math.floor(evRes.data && evRes.data.start_hour != null ? evRes.data.start_hour : 9);
        var eh = Math.ceil(evRes.data && evRes.data.end_hour != null ? evRes.data.end_hour : 21);
        sb.from("event_closed_hours").select("hour").eq("event_id", eventId).then(function (chRes) {
          var closed = (chRes.data || []).map(function (r) { return r.hour; });
          var grid = "";
          for (var h = sh; h < eh; h++) {
            var isClosed = closed.indexOf(h) >= 0;
            var ap = h >= 12 ? "pm" : "am", h12 = h % 12 || 12;
            grid += "<button class='abtn " + (isClosed ? "gray" : "green") + "' data-hour='" + h + "' style='margin:3px;'>" + h12 + ap + (isClosed ? " (closed)" : " (open)") + "</button>";
          }
          document.getElementById("hoursGridWrap").innerHTML = grid;
          document.querySelectorAll("#hoursGridWrap button").forEach(function (btn) {
            btn.onclick = function () {
              var hour = parseInt(btn.dataset.hour, 10);
              var isClosed = closed.indexOf(hour) >= 0;
              var op = isClosed
                ? sb.from("event_closed_hours").delete().eq("event_id", eventId).eq("hour", hour)
                : sb.from("event_closed_hours").insert({ event_id: eventId, hour: hour });
              op.then(function () { draw(); });
            };
          });
        });
      });
    }
    sel.onchange = draw;
    draw();
  });
}

document.addEventListener("DOMContentLoaded", init);
