/* Vendors — data and interactions. Vendor profiles are surfaced inside
   each event's detail view (see the "Registered Vendors" section built in
   js/app.js openDetail) and as pins on the map, rather than as a separate
   standalone page. Depends on globals from js/app.js (C, evts, openDetail,
   showMap, cls) and js/storage.js (Storage). Loaded after both. */
var vendors = [];
var VFAV_KEY = "vendor-favs-v1";
var VDATA_KEY = "vendors-v1";

/* A device that already saved vendor data once ignores VENDOR_DEF forever
   after that - which meant re-seeding real festival vendors here never
   actually reached a phone (like the organizer's own) that had already
   saved anything, even something unrelated. Merging in any seed vendor
   whose id isn't already present fixes that without touching or
   overwriting anything the device already has. */
function loadVendors() {
  var saved = Storage.get(VDATA_KEY, null);
  if (!saved) { vendors = JSON.parse(JSON.stringify(VENDOR_DEF)); return; }
  vendors = saved;
  var existingIds = saved.map(function (v) { return v.id; });
  var missing = VENDOR_DEF.filter(function (v) { return existingIds.indexOf(v.id) < 0; });
  if (missing.length) {
    vendors = vendors.concat(JSON.parse(JSON.stringify(missing)));
    saveVendors();
  }
}
function saveVendors() {
  if (!Storage.set(VDATA_KEY, vendors)) {
    alert("This business couldn't be saved - your browser's local storage is full. Try removing an old photo, then try again.");
  }
}

/* Runs immediately (not inside DOMContentLoaded) so `vendors` is already
   populated by the time app.js's init() renders the boards - both files
   listen for DOMContentLoaded, and app.js's listener was registered first
   since its <script> tag comes first, so waiting until then would be too
   late for the vendor lists on each flyer's back to have real data. */
loadVendors();

function getFavs() { return Storage.get(VFAV_KEY, []); }
function isFav(id) { return getFavs().indexOf(id) >= 0; }
function toggleFav(id) {
  var favs = getFavs();
  var i = favs.indexOf(id);
  if (i >= 0) favs.splice(i, 1); else favs.push(id);
  Storage.set(VFAV_KEY, favs);
}

/* A vendor is publicly visible only once approved and not deactivated -
   pending/rejected/denied listings (and approved ones an admin has since
   deactivated) stay hidden from the public board/map until acted on.
   isMyVendor() below still lets a vendor find their own pending listing
   via My Dashboard regardless of visibility, so submitting doesn't feel
   like it vanished. */
function isVendorVisible(v) { return v.status === "approved" && v.active !== false; }
function vendorEvents(v) {
  return (v.events || []).map(function (id) {
    return evts.find(function (e) { return e.id === id; });
  }).filter(Boolean);
}
function eventVendors(ev) {
  return vendors.filter(function (v) { return isVendorVisible(v) && (v.events || []).indexOf(ev.id) >= 0; });
}

/* Vendor profile detail — reuses the same .dpanel/.dhero/.dbody/.igrid
   markup the event detail modal already uses, so it looks consistent
   without needing its own CSS. */
function openVendorDetail(id, fromEventId) {
  var v = vendors.find(function (x) { return x.id === id; }); if (!v) return;
  var cat = C[v.cat] || { l: v.cat, i: "&#128204;", c: "#666" };
  var mu = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(v.address || v.name);
  var dp = document.getElementById("detPanel");
  dp.innerHTML = "";
  dp.dataset.vid = id;
  dp.dataset.fromEvent = fromEventId || "";
  delete dp.dataset.eid;

  var xb = document.createElement("button"); xb.className = "xbtn"; xb.textContent = "X";
  xb.onclick = cls; dp.appendChild(xb);

  /* Only vendors opened from inside an event's Vendor Hub list carry a
     fromEventId - map-pin/search-opened vendors have nowhere to "go
     back" to, so they keep just the X close button. */
  if (fromEventId) {
    var backBtn = document.createElement("button"); backBtn.className = "vhbtn back";
    backBtn.innerHTML = "&#8592; Back to Vendor Hub"; backBtn.title = "Back to Vendor Hub";
    backBtn.onclick = function (e) { e.stopPropagation(); backToVendorHub(fromEventId); };
    dp.appendChild(backBtn);
  }

  var hero = document.createElement("div"); hero.className = "dhero" + (v.cover ? " hp" : "");
  if (v.cover) {
    hero.style.backgroundImage = "url(" + v.cover + ")"; hero.style.backgroundSize = "cover"; hero.style.backgroundPosition = "center";
    var zoomBtn = document.createElement("button"); zoomBtn.className = "photozoom"; zoomBtn.innerHTML = "&#128269;"; zoomBtn.title = "View full photo";
    zoomBtn.onclick = function (e) { e.stopPropagation(); zoomPhoto(v.cover); };
    hero.appendChild(zoomBtn);
  } else { hero.innerHTML = v.logo ? v.logo : cat.i; }
  dp.appendChild(hero);

  var body = document.createElement("div"); body.className = "dbody";

  var rib = document.createElement("span"); rib.className = "rib " + v.cat; rib.style.marginBottom = "9px"; rib.textContent = cat.l;
  var h2 = document.createElement("h2"); h2.textContent = v.name;
  body.appendChild(rib); body.appendChild(h2);

  /* Badges reflect real purchased promotions (js/promo.js), scoped per
     event - a vendor with no active/upcoming promotion anywhere shows no
     badge at all, same as any other listing (no "Free Vendor" label). */
  var anyFeatured = (v.events || []).some(function (eid) { return vendorPromoBadges(v.id, eid).featured; });
  var anyBoost = (v.events || []).some(function (eid) { return vendorPromoBadges(v.id, eid).boostActive; });
  if (anyFeatured || anyBoost) {
    var badges = document.createElement("div"); badges.style.cssText = "display:flex;gap:6px;margin:4px 0 8px;flex-wrap:wrap;";
    if (anyFeatured) { var fb = document.createElement("span"); fb.className = "promo-badge featured"; fb.textContent = "Featured"; badges.appendChild(fb); }
    if (anyBoost) { var bb = document.createElement("span"); bb.className = "promo-badge boost"; bb.textContent = "Boost Live"; badges.appendChild(bb); }
    body.appendChild(badges);
  }

  var dloc = document.createElement("div"); dloc.className = "dloc";
  var dadr = document.createElement("span"); dadr.className = "dadr"; dadr.textContent = v.address || "Address on file";
  var mapBtn = document.createElement("a"); mapBtn.className = "ab blue"; mapBtn.href = mu; mapBtn.target = "_blank"; mapBtn.textContent = "Open in Maps";
  dloc.appendChild(dadr); dloc.appendChild(mapBtn);
  if (v.address) {
    var pinBtn = document.createElement("a"); pinBtn.className = "ab green"; pinBtn.textContent = "Find on Our Map";
    pinBtn.href = "../map/index.html?q=" + encodeURIComponent(v.name);
    dloc.appendChild(pinBtn);
  }
  body.appendChild(dloc);

  var desc = document.createElement("p"); desc.className = "ddesc"; desc.textContent = v.desc || "No description yet.";
  body.appendChild(desc);

  var crow = document.createElement("div"); crow.className = "dtags";
  if (v.contact && v.contact.phone) { var a = document.createElement("a"); a.className = "ab blue"; a.href = "tel:" + v.contact.phone; a.textContent = "Call"; crow.appendChild(a); }
  if (v.contact && v.contact.email) { var a2 = document.createElement("a"); a2.className = "ab gray"; a2.href = "mailto:" + v.contact.email; a2.textContent = "Email"; crow.appendChild(a2); }
  if (v.website) { var a3 = document.createElement("a"); a3.className = "ab green"; a3.href = v.website; a3.target = "_blank"; a3.textContent = "Website"; crow.appendChild(a3); }
  Object.keys(v.social || {}).forEach(function (k) {
    if (v.social[k]) { var s = document.createElement("a"); s.className = "ab dark"; s.href = v.social[k]; s.target = "_blank"; s.textContent = k.charAt(0).toUpperCase() + k.slice(1); crow.appendChild(s); }
  });
  if (crow.children.length) body.appendChild(crow);

  var igrid = document.createElement("div"); igrid.className = "igrid";
  function mkIbox(label, val) { var b = document.createElement("div"); b.className = "ibox"; b.innerHTML = "<h4>" + label + "</h4><p>" + (val || "See vendor.") + "</p>"; return b; }
  var hoursSummary = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]]
    .map(function (d) { return d[1] + ": " + ((v.hours && v.hours[d[0]]) || "Closed"); }).join("<br>");
  igrid.appendChild(mkIbox("Hours", hoursSummary));
  igrid.appendChild(mkIbox("Menu / Offerings", v.menu || "Menu coming soon."));
  igrid.appendChild(mkIbox("Category", cat.l));
  body.appendChild(igrid);

  var vEvts = vendorEvents(v);
  if (vEvts.length) {
    var vsec = document.createElement("div"); vsec.className = "vsec";
    var vh3 = document.createElement("h3"); vh3.textContent = "Upcoming Events";
    vsec.appendChild(vh3);
    vEvts.forEach(function (ev) {
      var vi = document.createElement("div"); vi.className = "vi"; vi.style.cssText = "cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;";
      var lbl = document.createElement("span"); lbl.textContent = ev.t + " — " + ev.w;
      vi.appendChild(lbl);
      var badges = vendorPromoBadges(v.id, ev.id);
      if (badges.featured || badges.boostActive || badges.boostUpcoming) {
        var bwrap = document.createElement("span"); bwrap.style.cssText = "display:flex;gap:4px;flex-shrink:0;";
        if (badges.featured) { var fb2 = document.createElement("span"); fb2.className = "promo-badge featured"; fb2.textContent = "Featured"; bwrap.appendChild(fb2); }
        if (badges.boostActive) { var bb2 = document.createElement("span"); bb2.className = "promo-badge boost"; bb2.textContent = "Boost Live"; bwrap.appendChild(bb2); }
        else if (badges.boostUpcoming) { var ub = document.createElement("span"); ub.className = "promo-badge upcoming"; ub.textContent = "Boost Soon"; bwrap.appendChild(ub); }
        vi.appendChild(bwrap);
      }
      vi.addEventListener("click", function () { openDetail(ev.id); });
      vsec.appendChild(vi);
    });
    body.appendChild(vsec);
  }

  var btns = document.createElement("div"); btns.className = "dbtnrow";
  var favBtn = document.createElement("button");
  function paintFav() { favBtn.className = "ab " + (isFav(v.id) ? "dark" : "gray"); favBtn.textContent = isFav(v.id) ? "Saved" : "Save"; }
  paintFav();
  favBtn.addEventListener("click", function () { toggleFav(v.id); paintFav(); });
  var shareBtn = document.createElement("button"); shareBtn.className = "ab gray"; shareBtn.textContent = "Share";
  shareBtn.addEventListener("click", function () { shareVendor(v.id); });
  var mapBtn2 = document.createElement("button"); mapBtn2.className = "ab blue"; mapBtn2.textContent = "View on Map";
  mapBtn2.addEventListener("click", function () { showVendorOnMap(v.id); });
  var dirBtn = document.createElement("a"); dirBtn.className = "ab green"; dirBtn.target = "_blank";
  dirBtn.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(v.address || v.name);
  dirBtn.textContent = "Directions";
  var editBtn = document.createElement("button"); editBtn.className = "ab dark"; editBtn.textContent = "Edit";
  editBtn.addEventListener("click", function () { openVendorForm(v.cat, v.id); });
  var promoBtn = document.createElement("button"); promoBtn.className = "ab green"; promoBtn.textContent = "🚀 Promote";
  promoBtn.addEventListener("click", function () { openPromoPicker(v.id); });
  var msgBtn = document.createElement("button"); msgBtn.className = "ab gray"; msgBtn.disabled = true;
  msgBtn.style.opacity = ".5"; msgBtn.textContent = "Message (Coming Soon)";
  var reportBtn = document.createElement("button"); reportBtn.className = "ab gray"; reportBtn.textContent = "Report";
  reportBtn.addEventListener("click", function () { openReportForm("vendor", v.id, v.name); });
  btns.appendChild(favBtn); btns.appendChild(shareBtn); btns.appendChild(mapBtn2); btns.appendChild(dirBtn); btns.appendChild(editBtn); btns.appendChild(promoBtn); btns.appendChild(msgBtn); btns.appendChild(reportBtn);
  body.appendChild(btns);

  dp.appendChild(body);
  document.getElementById("detOv").classList.add("on");
}

function shareVendor(id) {
  var v = vendors.find(function (x) { return x.id === id; }); if (!v) return;
  if (navigator.share) { navigator.share({ title: v.name, text: v.desc, url: location.href }).catch(function () {}); return; }
  if (!navigator.clipboard) { alert("Copy the URL from your browser bar."); return; }
  navigator.clipboard.writeText(location.href).then(function () { alert("Link copied!"); }, function () { alert("Couldn't copy automatically - copy the URL from your browser bar."); });
}

function showVendorOnMap(id) {
  showMap();
  hVendorPin(id);
}

/* Returns from a vendor's own detail page to the event flyer it was
   opened from, landing back on that event's Vendor Hub face (not the
   event-info face) so it feels like a "back" step rather than starting
   over from the flyer's front. */
function backToVendorHub(eventId) {
  openDetail(eventId);
  setTimeout(function () {
    var info = document.getElementById("infoView"), vhub = document.getElementById("vhubView"), btn = document.getElementById("vhToggle");
    if (info && vhub && btn) {
      info.style.display = "none"; vhub.style.display = "block";
      btn.innerHTML = "&#8617; Back to Flyer"; btn.title = "Back to Event Flyer";
      btn.classList.add("back");
    }
  }, 30);
}

/* ── MAP PINS (square markers, distinct from the round event pins) ── */
function renderVendorPins() {
  var g = document.getElementById("vPins"); if (!g) return;
  g.innerHTML = "";
  vendors.filter(function (v) { return v.mx && v.my && isVendorVisible(v); }).forEach(function (v) {
    var cat = C[v.cat] || { c: "#666", i: "&#128204;" };
    var pg = document.createElementNS("http://www.w3.org/2000/svg", "g");
    pg.setAttribute("class", "vp"); pg.setAttribute("id", "vpin-" + v.id);
    var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", v.mx - 9); rect.setAttribute("y", v.my - 9);
    rect.setAttribute("width", "18"); rect.setAttribute("height", "18"); rect.setAttribute("rx", "4");
    rect.setAttribute("fill", cat.c); rect.setAttribute("stroke", "white"); rect.setAttribute("stroke-width", "2.5");
    rect.setAttribute("opacity", v.featured ? "1" : "0.82");
    var txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", v.mx); txt.setAttribute("y", v.my + 4);
    txt.setAttribute("text-anchor", "middle"); txt.setAttribute("font-size", "10");
    txt.style.pointerEvents = "none"; txt.innerHTML = cat.i;
    pg.appendChild(rect); pg.appendChild(txt);
    pg.addEventListener("click", function () { openVendorDetail(v.id); });
    g.appendChild(pg);
  });
}
function hVendorPin(id) {
  document.querySelectorAll(".vp.pulse").forEach(function (p) { p.classList.remove("pulse"); });
  var p = document.getElementById("vpin-" + id); if (p) p.classList.add("pulse");
}

/* ── ADMIN MODERATION PLACEHOLDER ──
   Hidden behind ?admin=1 until real accounts/roles exist. Lets a site
   operator approve pending vendor listings and flip boost tiers on/off. */
function maybeShowAdminNav() {
  if (location.search.indexOf("admin=1") >= 0) {
    document.getElementById("nAdmin").style.display = "inline-block";
  }
}
function showAdmin() {
  document.getElementById("bView").style.display = "none";
  document.getElementById("tdwrap").style.display = "none";
  document.getElementById("mapSec").style.display = "none";
  document.getElementById("adminSec").style.display = "block";
  if (typeof showAdminTab === "function") showAdminTab("events");
  else renderAdminList();
}
function vendorTier(v) {
  if (typeof getBookings !== "function") return "Standard";
  var mine = getBookings().filter(function (b) { return b.vendorId === v.id && b.status !== "cancelled"; });
  if (!mine.length) return "Standard";
  if (mine.some(function (b) { return b.type === "featured"; })) return "Featured";
  if (mine.some(function (b) { return b.type === "boost"; })) return "Boost";
  return "Standard";
}

var vendorAdminFilter = "pending";

function renderAdminList() {
  var list = document.getElementById("adminList");
  if (!list) return;
  list.innerHTML = "";

  var bar = document.createElement("div");
  bar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;";
  ["pending", "approved", "rejected", "denied", "all"].forEach(function (s) {
    var b = document.createElement("button");
    b.className = "nb" + (s === vendorAdminFilter ? " on" : "");
    b.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    b.onclick = function () { vendorAdminFilter = s; renderAdminList(); };
    bar.appendChild(b);
  });
  list.appendChild(bar);

  /* Master history: every vendor that ever applied, filterable by status,
     newest first, showing tier + submitted timestamp + current status so
     nothing that was here before quietly disappears from view. */
  var rows = vendorAdminFilter === "all" ? vendors.slice() : vendors.filter(function (v) { return v.status === vendorAdminFilter; });
  if (!rows.length) {
    var empty = document.createElement("p"); empty.className = "aempty";
    empty.textContent = "No " + (vendorAdminFilter === "all" ? "" : vendorAdminFilter + " ") + "vendors.";
    list.appendChild(empty); return;
  }
  rows.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });

  rows.forEach(function (v) {
    var row = document.createElement("div");
    row.style.cssText = "background:rgba(253,246,224,.06);border:1px solid rgba(218,184,112,.2);border-radius:6px;padding:10px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;";

    var name = document.createElement("div");
    name.style.cssText = "font-family:'Special Elite',monospace;font-size:12.5px;color:var(--cl);flex:1;min-width:160px;";
    var when = v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "?";
    var statusLabel = v.status + (v.status === "approved" ? (v.active === false ? " / deactivated" : " / active") : "");
    name.innerHTML = escHtml(v.name) + "<br><span style='opacity:.65;font-size:10.5px;'>" + vendorTier(v) + " &middot; " + when + " &middot; " + statusLabel + "</span>" +
      (v.status === "denied" && v.denialReason ? "<br><span style='opacity:.6;font-size:10px;font-style:italic;'>" + escHtml(v.denialReason) + "</span>" : "");
    row.appendChild(name);

    if (v.status !== "approved") {
      var approveBtn = document.createElement("button"); approveBtn.className = "nb"; approveBtn.textContent = "Approve";
      approveBtn.onclick = function () { v.status = "approved"; v.active = true; v.denialReason = ""; saveVendors(); renderAdminList(); renderVendorPins(); };
      row.appendChild(approveBtn);
    }
    if (v.status === "approved" && v.active === false) {
      var activateBtn = document.createElement("button"); activateBtn.className = "nb"; activateBtn.textContent = "Activate";
      activateBtn.onclick = function () { v.active = true; saveVendors(); renderAdminList(); renderVendorPins(); };
      row.appendChild(activateBtn);
    }
    if (v.status === "approved" && v.active !== false) {
      var deactivateBtn = document.createElement("button"); deactivateBtn.className = "nb"; deactivateBtn.textContent = "Deactivate";
      deactivateBtn.onclick = function () { v.active = false; saveVendors(); renderAdminList(); renderVendorPins(); };
      row.appendChild(deactivateBtn);
    }
    if (v.status !== "rejected") {
      var rejectBtn = document.createElement("button"); rejectBtn.className = "nb"; rejectBtn.textContent = "Reject";
      rejectBtn.onclick = function () { v.status = "rejected"; saveVendors(); renderAdminList(); renderVendorPins(); };
      row.appendChild(rejectBtn);
    }
    if (v.status !== "denied") {
      var denyBtn = document.createElement("button"); denyBtn.className = "nb"; denyBtn.textContent = "Deny";
      denyBtn.onclick = function () {
        if (!confirm("Deny " + v.name + "'s application? They'll be told: \"Your vendor application could not be verified at this time.\"")) return;
        v.status = "denied"; v.denialReason = "Your vendor application could not be verified at this time.";
        saveVendors(); renderAdminList(); renderVendorPins();
      };
      row.appendChild(denyBtn);
    }

    var promoCount = typeof getBookings === "function"
      ? getBookings().filter(function (b) { return b.vendorId === v.id && b.status !== "cancelled"; }).length
      : 0;
    var bkBtn = document.createElement("button");
    bkBtn.className = "nb"; bkBtn.textContent = promoCount ? "Bookings (" + promoCount + ")" : "Bookings";
    bkBtn.onclick = function () { showAdminTab("bookings"); };
    row.appendChild(bkBtn);

    list.appendChild(row);
  });
}

/* ── ADD / EDIT FORM (a lightweight vendor dashboard placeholder — no
   real auth yet, so anyone can edit any listing, same permission model
   the existing event flyer form already uses) ── */
function openVendorForm(defCat, vid, eventId) {
  var fp = document.getElementById("vfrmPanel");
  var opts = Object.entries(C).map(function (e) { return "<option value='" + e[0] + "'>" + e[1].l + "</option>"; }).join("");
  fp.innerHTML = "<div class='fi'><h2>" + (vid ? "Edit Your Business" : "Add Your Business") + "</h2>" +
    "<label>Business Name *</label><input id='vn' type='text' list='vnList' placeholder='e.g. Xiong Farms' autocomplete='off'>" +
    "<datalist id='vnList'></datalist>" +
    "<label>Category</label><select id='vcat'>" + opts + "</select>" +
    "<label>Description</label><textarea id='vd' placeholder='Tell customers about your business...'></textarea>" +
    "<label>Menu / Offerings</label><textarea id='vmenu' placeholder='List a few items or paste a menu link...'></textarea>" +
    "<label>Address</label><input id='va' type='text' placeholder='Street address'>" +
    "<label>Phone</label><input id='vph' type='text' placeholder='(408) 555-0100'>" +
    "<label>Email</label><input id='vem' type='text' placeholder='hello@business.com'>" +
    "<label>Website</label><input id='vwb' type='text' placeholder='https://'>" +
    "<label>Instagram</label><input id='vig' type='text' placeholder='https://instagram.com/yourbiz'>" +
    "<p style='font-size:11.5px;color:rgba(90,65,30,.65);margin:6px 0 2px;'>Payment handles - shown to a buyer only after they check out for a paid promotion, so they can pay you directly through your own app. Optional, but at least one is needed for buyers to pay you.</p>" +
    "<label>Venmo</label><input id='vpay_venmo' type='text' placeholder='@your-venmo'>" +
    "<label>Cash App</label><input id='vpay_cashapp' type='text' placeholder='$yourcashtag'>" +
    "<label>Zelle</label><input id='vpay_zelle' type='text' placeholder='phone or email'>" +
    "<label>Other payment info</label><input id='vpay_other' type='text' placeholder='e.g. PayPal.me link'>" +
    ["mon","tue","wed","thu","fri","sat","sun"].map(function (d) {
      var lbl = d.charAt(0).toUpperCase() + d.slice(1) + " Hours";
      return "<label>" + lbl + "</label><input id='vh_" + d + "' type='text' placeholder='e.g. 9am-5pm or Closed'>";
    }).join("") +
    "<label>Logo (optional upload)</label><input id='vlg' type='file' accept='image/*'>" +
    "<label>Cover Photo (optional upload)</label><input id='vcv' type='file' accept='image/*'>" +
    "<div class='facts'><button class='bcan' id='vfrmCan'>Cancel</button><button class='bsub' id='vfrmSub'>Save Business</button></div>" +
    "</div>";
  fp.dataset.vid = vid || "";
  fp.dataset.eventId = eventId || "";
  /* Suggests existing business names while typing so someone re-adding
     their own (or a friend's) listing notices it's already there instead
     of quietly creating a lookalike duplicate. */
  document.getElementById("vnList").innerHTML = vendors
    .filter(function (x) { return x.id !== vid; })
    .map(function (x) { return "<option value='" + x.name.replace(/'/g, "&#39;") + "'>"; })
    .join("");
  if (defCat) document.getElementById("vcat").value = defCat;
  document.getElementById("vfrmCan").onclick = vCls;
  document.getElementById("vfrmSub").onclick = subVendorForm;
  if (vid) {
    var v = vendors.find(function (x) { return x.id === vid; });
    if (v) {
      function sv(i, val) { var el = document.getElementById(i); if (el) el.value = val || ""; }
      sv("vn", v.name); sv("vd", v.desc); sv("vmenu", v.menu); sv("va", v.address);
      sv("vph", v.contact && v.contact.phone); sv("vem", v.contact && v.contact.email);
      sv("vwb", v.website); sv("vig", v.social && v.social.instagram);
      sv("vpay_venmo", v.payment && v.payment.venmo); sv("vpay_cashapp", v.payment && v.payment.cashapp);
      sv("vpay_zelle", v.payment && v.payment.zelle); sv("vpay_other", v.payment && v.payment.other);
      ["mon","tue","wed","thu","fri","sat","sun"].forEach(function (d) { sv("vh_" + d, v.hours && v.hours[d]); });
      document.getElementById("vcat").value = v.cat;
    }
  }
  document.getElementById("vfrmOv").classList.add("on");
}

function vCls() {
  document.getElementById("vfrmOv").classList.remove("on");
  document.getElementById("vfrmPanel").innerHTML = "";
}

/* "+ Add Your Business" used to always create a brand-new listing, even
   for a vendor who already has one from a previous event - forcing them
   to redo the whole menu/hours/contact form each time instead of just
   linking their existing account to the new event. Now it offers to link
   an existing listing first (if this device has one not already linked
   to this event), and only falls through to the blank form for a
   genuinely new business or once there's nothing left to link. */
function startAddVendorFlow(cat, eventId) {
  var mine = getMyVendorIds().map(function (id) { return vendors.find(function (x) { return x.id === id; }); }).filter(Boolean);
  var unlinked = mine.filter(function (v) { return (v.events || []).indexOf(eventId) < 0; });
  if (!unlinked.length) { openVendorForm(cat, "", eventId); return; }
  var fp = document.getElementById("vfrmPanel");
  var cards = unlinked.map(function (v) {
    return "<div class='promo-card' data-vid='" + v.id + "'><h3>" + escHtml(v.name) + "</h3><p>Link this listing to this event - no new form to fill out.</p></div>";
  }).join("");
  fp.innerHTML = "<div class='fi'><h2>Add Your Business</h2>" +
    "<p style='font-size:13px;margin-bottom:10px;'>You already have " + (unlinked.length > 1 ? "listings" : "a listing") + " on this device:</p>" +
    "<div class='promo-cards'>" + cards + "</div>" +
    "<div class='facts'><button class='bcan' id='vNewInstead'>+ New Business Instead</button></div></div>";
  fp.querySelectorAll(".promo-card").forEach(function (card) {
    card.onclick = function () {
      var v = vendors.find(function (x) { return x.id === card.dataset.vid; });
      if (!v) return;
      v.events = v.events || [];
      if (v.events.indexOf(eventId) < 0) v.events.push(eventId);
      saveVendors(); vCls(); backToVendorHub(eventId);
    };
  });
  document.getElementById("vNewInstead").onclick = function () { openVendorForm(cat, "", eventId); };
  document.getElementById("vfrmOv").classList.add("on");
}

function subVendorForm() {
  var name = document.getElementById("vn").value.trim();
  if (!name) { alert("Please add a business name."); return; }
  var vid = document.getElementById("vfrmPanel").dataset.vid;
  var eventId = document.getElementById("vfrmPanel").dataset.eventId;
  var cat = document.getElementById("vcat").value;
  var v = {
    id: vid || "vu" + Date.now(), name: name, cat: cat,
    desc: document.getElementById("vd").value.trim(),
    menu: document.getElementById("vmenu").value.trim(),
    address: document.getElementById("va").value.trim(),
    contact: { phone: document.getElementById("vph").value.trim(), email: document.getElementById("vem").value.trim() },
    website: normalizeUrl(document.getElementById("vwb").value),
    social: { instagram: normalizeUrl(document.getElementById("vig").value) },
    payment: {
      venmo: document.getElementById("vpay_venmo").value.trim(),
      cashapp: document.getElementById("vpay_cashapp").value.trim(),
      zelle: document.getElementById("vpay_zelle").value.trim(),
      other: document.getElementById("vpay_other").value.trim()
    },
    hours: ["mon","tue","wed","thu","fri","sat","sun"].reduce(function (h, d) {
      var el = document.getElementById("vh_" + d);
      if (el && el.value.trim()) h[d] = el.value.trim();
      return h;
    }, {}),
    featured: false, verified: false,
    boost: { tier: null, active: false, until: "", radius: null },
    mx: 380 + (Math.random() - 0.5) * 120, my: 420 + (Math.random() - 0.5) * 80,
    city: "sj", events: eventId ? [eventId] : [], gallery: [], logo: "", cover: "",
    /* This listing only ever lives in the vendor's own browser - nobody
       else's device can see or approve it, so gating it behind "pending"
       just hid it from the one person who's supposed to see it: the
       vendor themselves, right after they filled out the form. Approved
       immediately; the admin history table below can still deactivate
       one if needed. */
    status: "approved", active: true, denialReason: "", createdAt: new Date().toISOString()
  };
  var isNew = !vid;
  function done() {
    if (vid) {
      var i = vendors.findIndex(function (x) { return x.id === vid; });
      if (i >= 0) {
        var old = vendors[i];
        v.featured = old.featured; v.boost = old.boost;
        v.mx = old.mx; v.my = old.my; v.gallery = old.gallery;
        v.status = old.status; v.active = old.active; v.denialReason = old.denialReason;
        v.createdAt = old.createdAt || v.createdAt;
        v.logo = v.logo || old.logo; v.cover = v.cover || old.cover;
        v.events = old.events || [];
        if (eventId && v.events.indexOf(eventId) < 0) v.events.push(eventId);
        vendors[i] = v;
      }
    } else vendors.push(v);
    saveVendors(); vCls(); renderVendorPins();
    if (typeof markMyVendor === "function") markMyVendor(v.id);
    if (typeof updateDashNavVisibility === "function") updateDashNavVisibility();
    if (typeof renderBoards === "function") renderBoards();
    if (document.getElementById("detOv").classList.contains("on") && document.getElementById("detPanel").dataset.eid) {
      openDetail(document.getElementById("detPanel").dataset.eid);
    }
    /* Prompt Premium Promotion right after a NEW listing is created (not
       on every edit, which would get old fast) - the small delay lets
       vCls()/openDetail() above finish settling before the promo
       overlay stacks on top. */
    if (isNew && typeof openPromoPicker === "function") {
      setTimeout(function () { openPromoPicker(v.id, undefined, true); }, 250);
    }
  }
  var logoFile = document.getElementById("vlg").files[0];
  var coverFile = document.getElementById("vcv").files[0];
  if (coverFile) {
    resizeImageFile(coverFile, 1100, 0.82, function (dataUrl) {
      v.cover = dataUrl;
      if (logoFile) resizeImageFile(logoFile, 300, 0.85, function (logoUrl) { v.logo = logoUrl; done(); });
      else done();
    });
  } else if (logoFile) {
    resizeImageFile(logoFile, 300, 0.85, function (logoUrl) { v.logo = logoUrl; done(); });
  } else done();
}

document.addEventListener("DOMContentLoaded", function () {
  renderVendorPins();
  maybeShowAdminNav();
});
