/* Vendor Hub promotions — UI layer (picker, mock checkout, Vendor
   Dashboard, Admin Dashboard tabs). Pure rendering/wiring; all the
   data/booking logic lives in js/promo.js. Depends on globals from
   js/app.js, js/vendors.js and js/promo.js. Loaded last. */

function priceLabel(amount) { return amount === 0 ? "FREE" : "$" + amount; }

function escHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* ── Promotion picker (event -> type -> hour -> slots -> checkout) ── */
var promoState = {};

function openPromoPicker(vendorId, preferredEventId, isNewListing) {
  var v = vendors.find(function (x) { return x.id === vendorId; });
  if (!v) return;
  promoState = { vendorId: vendorId, isNewListing: !!isNewListing };
  var myEvents = vendorEvents(v);
  document.getElementById("promoOv").classList.add("on");
  if (preferredEventId && myEvents.some(function (e) { return e.id === preferredEventId; })) {
    promoState.eventId = preferredEventId; renderPromoTypeStep();
  } else if (!myEvents.length) renderPromoNoEvents(v);
  else if (myEvents.length === 1) { promoState.eventId = myEvents[0].id; renderPromoTypeStep(); }
  else renderPromoEventStep(myEvents);
}
function promoCls() {
  document.getElementById("promoOv").classList.remove("on");
  document.getElementById("promoPanel").innerHTML = "";
  promoState = {};
  if (promoSuccessTimer) { clearInterval(promoSuccessTimer); promoSuccessTimer = null; }
}

function renderPromoNoEvents(v) {
  var p = document.getElementById("promoPanel");
  p.innerHTML = "<div class='promo-step'><div class='promo-head'><h2>Promote " + escHtml(v.name) + "</h2></div>" +
    "<p class='promo-sub'>This listing isn't linked to an event yet — promotions are tied to a specific event's Vendor Hub. Add the link from Edit, or add your business again from that event's \"+ Add Your Business\" button.</p>" +
    "<div class='facts'><button class='bcan' id='promoCloseBtn'>Close</button></div></div>";
  document.getElementById("promoCloseBtn").onclick = promoCls;
}

function renderPromoEventStep(myEvents) {
  var v = vendors.find(function (x) { return x.id === promoState.vendorId; });
  var p = document.getElementById("promoPanel");
  var cards = myEvents.map(function (ev) {
    return "<div class='promo-card' data-eid='" + ev.id + "'><h3>" + escHtml(ev.t) + "</h3><p>" + escHtml(ev.w || "") + "</p></div>";
  }).join("");
  p.innerHTML = "<div class='promo-step'><div class='promo-head'><h2>Promote " + escHtml(v.name) + "</h2></div>" +
    "<p class='promo-sub'>Which event's Vendor Hub do you want to promote in?</p>" +
    "<div class='promo-cards'>" + cards + "</div>" +
    "<div class='facts'><button class='bcan' id='promoCloseBtn'>Cancel</button></div></div>";
  document.getElementById("promoCloseBtn").onclick = promoCls;
  p.querySelectorAll(".promo-card").forEach(function (card) {
    card.onclick = function () { promoState.eventId = card.dataset.eid; renderPromoTypeStep(); };
  });
}

function renderPromoTypeStep() {
  var v = vendors.find(function (x) { return x.id === promoState.vendorId; });
  var ev = evts.find(function (x) { return x.id === promoState.eventId; });
  var pricing = getPricing();
  var p = document.getElementById("promoPanel");
  var intro = promoState.isNewListing
    ? "<p class='promo-sub'>" + escHtml(v.name) + " is live and free in " + escHtml(ev.t) + "'s Vendor Hub. These spotlight upgrades are free today too - no card, no payment, nothing to enter.</p>"
    : "<p class='promo-sub'>For: " + escHtml(ev.t) + " - free today, no card or payment needed.</p>";
  var skipLabel = promoState.isNewListing ? "No thanks, stay free" : "Cancel";
  p.innerHTML = "<div class='promo-step'>" +
    "<div class='promo-head'><h2>Promote " + escHtml(v.name) + "</h2></div>" +
    intro +
    "<div class='promo-cards'>" +
    "<div class='promo-card' id='pcBoost'><h3>&#128640; Boost</h3><span class='pc-price'>" + priceLabel(pricing.boost) + "</span>" +
    "<p>Two 10-minute slots (20 minutes total) during an event hour you pick. Puts your listing in the Top 10 spotlight while your slots run.</p></div>" +
    "<div class='promo-card' id='pcFeatured'><h3>&#11088; Featured</h3><span class='pc-price'>" + priceLabel(pricing.featured) + "</span>" +
    "<p>One 30-minute slot during an event hour you pick. Top-5 spotlight placement with a Featured badge while it runs.</p></div>" +
    "</div>" +
    "<div class='facts'><button class='bcan' id='promoCloseBtn'>" + skipLabel + "</button></div></div>";
  document.getElementById("promoCloseBtn").onclick = promoCls;
  document.getElementById("pcBoost").onclick = function () { promoState.type = "boost"; renderPromoHourStep(); };
  document.getElementById("pcFeatured").onclick = function () { promoState.type = "featured"; renderPromoHourStep(); };
}

function renderPromoHourStep() {
  var v = vendors.find(function (x) { return x.id === promoState.vendorId; });
  var ev = evts.find(function (x) { return x.id === promoState.eventId; });
  var typeLabel = promoState.type === "boost" ? "Boost" : "Featured";
  var hours = openHoursFor(ev, promoState.type);
  var p = document.getElementById("promoPanel");
  var grid = hours.map(function (h) {
    var label = h.status === "open" ? "Open" : h.status === "full" ? "Full" : h.status === "past" ? "Ended" : "Closed";
    return "<button class='hourbtn" + (h.status !== "open" ? " " + h.status : "") + "' data-hour='" + h.hour + "'" + (h.status !== "open" ? " disabled" : "") + ">" + fmtHour(h.hour) + "<span class='hbstat'>" + label + "</span></button>";
  }).join("");
  p.innerHTML = "<div class='promo-step'>" +
    "<div class='promo-head'><button class='promo-back' id='promoBackBtn'>&#8592;</button><h2>&#128339; Pick an hour</h2></div>" +
    "<p class='promo-sub'>" + escHtml(ev.t) + " — choose an open hour for " + escHtml(v.name) + "'s " + typeLabel + ".</p>" +
    "<div class='hourgrid'>" + (grid || "<p class='promo-sub'>No bookable hours are open for this event yet.</p>") + "</div>" +
    "<div class='facts'><button class='bcan' id='promoCloseBtn'>Cancel</button></div></div>";
  document.getElementById("promoCloseBtn").onclick = promoCls;
  document.getElementById("promoBackBtn").onclick = renderPromoTypeStep;
  p.querySelectorAll(".hourbtn:not(:disabled)").forEach(function (btn) {
    btn.onclick = function () { promoState.hour = parseInt(btn.dataset.hour, 10); promoState.slots = []; renderPromoSlotStep(); };
  });
}

function renderPromoSlotStep() {
  var v = vendors.find(function (x) { return x.id === promoState.vendorId; });
  var ev = evts.find(function (x) { return x.id === promoState.eventId; });
  var type = promoState.type;
  var need = MIN_FREE_TO_STAY_OPEN[type];
  var total = SLOTS_PER_HOUR[type];
  var date = nextOccurrenceDate(ev);
  var taken = takenSlotsFor(ev.id, date, promoState.hour, type);
  var p = document.getElementById("promoPanel");
  function slotsHtml() {
    var out = "";
    for (var i = 0; i < total; i++) {
      var isTaken = taken.indexOf(i) >= 0;
      var isOn = promoState.slots.indexOf(i) >= 0;
      out += "<button class='slotbtn" + (isTaken ? " taken" : isOn ? " on" : "") + "' data-i='" + i + "'" + (isTaken ? " disabled" : "") + ">" + slotTimeLabel(promoState.hour, i, type) + "</button>";
    }
    return out;
  }
  function wireSlots() {
    p.querySelectorAll(".slotbtn:not(.taken)").forEach(function (btn) {
      btn.onclick = function () {
        var i = parseInt(btn.dataset.i, 10);
        var idx = promoState.slots.indexOf(i);
        if (idx >= 0) promoState.slots.splice(idx, 1);
        else if (promoState.slots.length < need) promoState.slots.push(i);
        document.getElementById("slotGrid").innerHTML = slotsHtml();
        wireSlots();
        document.getElementById("slotNextBtn").disabled = promoState.slots.length !== need;
      };
    });
  }
  var pickLabel = need === 1 ? "Pick one 30-min slot" : "Pick two 10-min slots";
  var tapLabel = need === 1 ? "Tap one." : "Tap exactly two.";
  p.innerHTML = "<div class='promo-step'>" +
    "<div class='promo-head'><button class='promo-back' id='promoBackBtn'>&#8592;</button><h2>&#9201; " + pickLabel + "</h2></div>" +
    "<p class='promo-sub'>" + escHtml(ev.t) + " — " + fmtHour(promoState.hour) + " hour. " + tapLabel + "</p>" +
    "<div class='slotgrid" + (total === 2 ? " slotgrid-2" : "") + "' id='slotGrid'>" + slotsHtml() + "</div>" +
    "<div class='facts'><button class='bcan' id='promoCloseBtn'>Cancel</button><button class='bsub' id='slotNextBtn' disabled>Continue</button></div></div>";
  document.getElementById("promoCloseBtn").onclick = promoCls;
  document.getElementById("promoBackBtn").onclick = renderPromoHourStep;
  wireSlots();
  document.getElementById("slotNextBtn").onclick = function () { if (promoState.slots.length === need) renderPromoCheckout(); };
}

/* No card fields collected here on purpose - money never routes through
   Citypinned. A buyer gets the vendor's own payment handles (Venmo/Cash
   App/Zelle/other) only after agreeing this is an advertising directory,
   not a payment processor, then self-confirms once they've paid the
   vendor directly through that app. Real Stripe/payment-processor
   integration is a separate follow-up. */
function renderPromoCheckout() {
  var v = vendors.find(function (x) { return x.id === promoState.vendorId; });
  var ev = evts.find(function (x) { return x.id === promoState.eventId; });
  var pricing = getPricing();
  var type = promoState.type;
  var amount = pricing[type];
  var typeLabel = type === "boost" ? "Boost" : "Featured";
  var slotWords = promoState.slots.slice().sort(function (a, b) { return a - b; }).map(function (i) { return slotTimeLabel(promoState.hour, i, type); }).join(" &amp; ");
  var summary = "<b>" + typeLabel + "</b> for " + escHtml(v.name) + " during " + escHtml(ev.t) + "<br>" +
    fmtHour(promoState.hour) + " hour, " + slotWords;
  var payment = v.payment || {};
  var p = document.getElementById("promoPanel");

  /* $0 means there's no actual payment to make, so the "get vendor
     payment info / confirm I paid" dance is pure friction - it was
     blocking free listings on vendors who hadn't filled in a Venmo/
     Cash App handle, showing an "error" for something that was never
     going to involve money. Skip straight to activating. */
  if (amount === 0) {
    p.innerHTML = "<div class='promo-step fi'>" +
      "<div class='promo-head'><button class='promo-back' id='promoBackBtn'>&#8592;</button><h2>&#127881; " + typeLabel + " - Free Today</h2></div>" +
      "<div class='promo-summary'>" + summary + "<br><b>Total: FREE</b> - no card, no payment info needed.</div>" +
      "<div id='promoCkErr'></div>" +
      "<div class='facts'>" +
      "<button class='bcan' id='promoCloseBtn'>Cancel</button>" +
      "<button class='bsub' id='confirmFreeBtn'>Activate - It's Free</button>" +
      "</div></div>";
    document.getElementById("promoCloseBtn").onclick = promoCls;
    document.getElementById("promoBackBtn").onclick = renderPromoSlotStep;
    document.getElementById("confirmFreeBtn").onclick = function () {
      var btn = document.getElementById("confirmFreeBtn");
      btn.disabled = true; btn.textContent = "Activating…";
      var result = type === "boost"
        ? reserveBoost(promoState.eventId, promoState.vendorId, promoState.hour, promoState.slots)
        : reserveFeatured(promoState.eventId, promoState.vendorId, promoState.hour, promoState.slots[0]);
      if (!result.ok) {
        document.getElementById("promoCkErr").innerHTML = "<div class='promo-err'>" + escHtml(result.reason) + "</div>";
        btn.disabled = false; btn.textContent = "Activate - It's Free";
        return;
      }
      if (v.status !== "approved") { v.status = "approved"; v.active = true; saveVendors(); }
      renderPromoSuccess(result.booking);
    };
    return;
  }

  p.innerHTML = "<div class='promo-step'>" +
    "<div class='promo-head'><button class='promo-back' id='promoBackBtn'>&#8592;</button><h2>&#128179; Pay the Vendor Directly</h2></div>" +
    "<div class='promo-summary'>" + summary + "<br><b>Total: $" + amount + "</b></div>" +
    "<div id='promoCkErr'></div>" +
    "<p style='font-size:11px;line-height:1.5;color:rgba(90,65,30,.75);margin:10px 0;'>" + PLATFORM_DISCLAIMER + "</p>" +
    "<label style='display:flex;align-items:flex-start;gap:8px;font-size:12.5px;text-transform:none;font-weight:400;letter-spacing:normal;'><input type='checkbox' id='payAgree' style='width:16px;flex:0 0 16px;margin-top:3px;'><span style='flex:1;min-width:0;'>I agree that BayPinned and its sister city networks (including Citypinned) are advertising directories only, do not process this payment, and cannot issue refunds or resolve disputes.</span></label>" +
    "<div id='payInfoWrap' style='display:none;margin-top:12px;'></div>" +
    "<div class='facts'>" +
    "<button class='bcan' id='promoCloseBtn'>Cancel</button>" +
    "<button class='bsub' id='getInfoBtn' disabled>Get Vendor Payment Info</button>" +
    "<button class='bsub' id='confirmPaidBtn' style='display:none;'>Confirm I Paid Vendor</button>" +
    "</div></div>";
  p.querySelector(".promo-step").classList.add("fi");
  document.getElementById("promoCloseBtn").onclick = promoCls;
  document.getElementById("promoBackBtn").onclick = renderPromoSlotStep;

  var agreeChk = document.getElementById("payAgree"), getInfoBtn = document.getElementById("getInfoBtn");
  agreeChk.onchange = function () { getInfoBtn.disabled = !agreeChk.checked; };

  getInfoBtn.onclick = function () {
    var wrap = document.getElementById("payInfoWrap");
    var lines = [];
    if (payment.venmo) lines.push("<div><b>Venmo:</b> " + escHtml(payment.venmo) + "</div>");
    if (payment.cashapp) lines.push("<div><b>Cash App:</b> " + escHtml(payment.cashapp) + "</div>");
    if (payment.zelle) lines.push("<div><b>Zelle:</b> " + escHtml(payment.zelle) + "</div>");
    if (payment.other) lines.push("<div><b>Other:</b> " + escHtml(payment.other) + "</div>");
    wrap.innerHTML = lines.length
      ? "<div class='promo-summary'>Pay $" + amount + " to " + escHtml(v.name) + " using:<br>" + lines.join("") + "</div>"
      : "<div class='promo-err'>This vendor hasn't added payment info yet - contact them directly to arrange payment.</div>";
    wrap.style.display = "block";
    getInfoBtn.style.display = "none";
    if (lines.length) document.getElementById("confirmPaidBtn").style.display = "inline-block";
  };

  document.getElementById("confirmPaidBtn").onclick = function () {
    var btn = document.getElementById("confirmPaidBtn");
    btn.disabled = true; btn.textContent = "Confirming…";
    var result = type === "boost"
      ? reserveBoost(promoState.eventId, promoState.vendorId, promoState.hour, promoState.slots)
      : reserveFeatured(promoState.eventId, promoState.vendorId, promoState.hour, promoState.slots[0]);
    if (!result.ok) {
      document.getElementById("promoCkErr").innerHTML = "<div class='promo-err'>" + escHtml(result.reason) + "</div>";
      btn.disabled = false; btn.textContent = "Confirm I Paid Vendor";
      return;
    }
    /* A confirmed paid booking is proof-of-intent on its own — don't make
       vendors wait on a manual approval to actually appear after paying
       for a Boost/Featured slot. They still show up in the admin's
       Bookings tab either way, so nothing goes unreviewed. */
    if (v.status !== "approved") { v.status = "approved"; v.active = true; saveVendors(); }
    renderPromoSuccess(result.booking);
  };
}

var promoSuccessTimer = null;
function renderPromoSuccess(booking) {
  var p = document.getElementById("promoPanel");
  var typeLabel = booking.type === "boost" ? "Boost" : "Featured";
  p.innerHTML = "<div class='promo-step'><div class='promo-head'><h2>Promotion Active</h2></div>" +
    "<div class='promo-ok'>Payment confirmed (demo) — your " + typeLabel + " is booked.<br><span class='countdown' id='promoSuccessClock'>&hellip;</span></div>" +
    "<div class='facts'><button class='bsub' id='promoDoneBtn'>Done</button></div></div>";
  function tick() {
    var el = document.getElementById("promoSuccessClock");
    if (!el) { if (promoSuccessTimer) clearInterval(promoSuccessTimer); return; }
    var text = booking.type === "boost"
      ? promoCountdownText(booking.vendorId, booking.eventId, "boost", "&#128640;", "Boost")
      : promoCountdownText(booking.vendorId, booking.eventId, "featured", "&#11088;", "Featured");
    el.innerHTML = text || "Promotion window has passed.";
  }
  if (promoSuccessTimer) clearInterval(promoSuccessTimer);
  tick();
  promoSuccessTimer = setInterval(tick, 1000);
  document.getElementById("promoDoneBtn").onclick = function () {
    if (promoSuccessTimer) { clearInterval(promoSuccessTimer); promoSuccessTimer = null; }
    promoCls(); refreshOpenViewsAfterPromo();
  };
}

/* ── Vendor Dashboard ── */
var dashCountdownTimer = null;

function openVendorDashboard() {
  renderVendorDashboard();
  document.getElementById("dashOv").classList.add("on");
  if (dashCountdownTimer) clearInterval(dashCountdownTimer);
  dashCountdownTimer = setInterval(renderDashCountdowns, 1000);
}
function dashCls() {
  document.getElementById("dashOv").classList.remove("on");
  document.getElementById("dashPanel").innerHTML = "";
  if (dashCountdownTimer) { clearInterval(dashCountdownTimer); dashCountdownTimer = null; }
}

function renderVendorDashboard() {
  var ids = getMyVendorIds();
  var mine = vendors.filter(function (v) { return ids.indexOf(v.id) >= 0; });
  var p = document.getElementById("dashPanel");
  var html = "<div class='fi'><h2>My Vendor Dashboard</h2>";
  if (!mine.length) {
    html += "<p class='dash-empty'>No listings yet on this device. Add your business from any event's Vendor Hub to get started.</p>";
  } else {
    html += "<div class='dash-sec'><h3>My Listings</h3>";
    mine.forEach(function (v) {
      var vEvts = vendorEvents(v);
      html += "<div class='dash-listing'><h4>" + escHtml(v.name) + "</h4>";
      if (!vEvts.length) {
        html += "<p class='dash-empty' style='padding:2px 0;'>Not linked to an event yet.</p>";
      } else {
        vEvts.forEach(function (ev) {
          html += "<div class='dash-row'><span style='font-size:12.5px;color:#3a2810;'>" + escHtml(ev.t) + "</span>" +
            "<span class='dash-cd' data-vid='" + v.id + "' data-eid='" + ev.id + "'></span></div>";
        });
      }
      html += "<div class='dash-row'><button class='ab green promdash-btn' data-vid='" + v.id + "'>Promote</button>" +
        "<button class='ab dark promdash-edit' data-vid='" + v.id + "' data-cat='" + v.cat + "'>Edit Listing</button></div></div>";
    });
    html += "</div>";
  }
  html += "<div class='dash-sec'><h3>Payment &amp; Promotion History</h3>";
  var history = getBookings().filter(function (b) { return ids.indexOf(b.vendorId) >= 0; })
    .sort(function (a, b) { return new Date(b.purchasedAt) - new Date(a.purchasedAt); });
  if (!history.length) {
    html += "<p class='dash-empty'>No promotions purchased yet.</p>";
  } else {
    html += "<div class='dash-table-wrap'><table class='dash-table'><thead><tr><th>Date</th><th>Vendor</th><th>Event</th><th>Type</th><th>Detail</th><th>Amount</th><th>Status</th></tr></thead><tbody>";
    history.forEach(function (b) {
      var v = vendors.find(function (x) { return x.id === b.vendorId; });
      var ev = evts.find(function (x) { return x.id === b.eventId; });
      var detail = fmtHour(b.hour) + " hour, " + b.slots.length + (b.type === "boost" ? " x 10min" : " x 30min") + " slot" + (b.slots.length > 1 ? "s" : "");
      var status = b.status === "cancelled" ? "cancelled" : bookingLiveStatus(b);
      html += "<tr><td>" + new Date(b.purchasedAt).toLocaleDateString() + "</td><td>" + escHtml(v ? v.name : "?") + "</td><td>" +
        escHtml(ev ? ev.t : "?") + "</td><td>" + (b.type === "boost" ? "Boost" : "Featured") + "</td><td>" + detail + "</td><td>$" + b.amount + "</td><td>" +
        status.charAt(0).toUpperCase() + status.slice(1) + "</td></tr>";
    });
    html += "</tbody></table></div>";
  }
  html += "</div><div class='facts'><button class='bcan' id='dashCloseBtn'>Close</button></div></div>";
  p.innerHTML = html;
  document.getElementById("dashCloseBtn").onclick = dashCls;
  p.querySelectorAll(".promdash-btn").forEach(function (btn) {
    btn.onclick = function () { dashCls(); openPromoPicker(btn.dataset.vid); };
  });
  p.querySelectorAll(".promdash-edit").forEach(function (btn) {
    btn.onclick = function () { dashCls(); openVendorForm(btn.dataset.cat, btn.dataset.vid); };
  });
  renderDashCountdowns();
}

/* One live-countdown-or-upcoming-ETA string for a single promo type
   (boost or featured) on a vendor+event, or "" if nothing to show. */
function promoCountdownText(vid, eid, type, icon, label) {
  var active = getBookings().find(function (b) { return b.vendorId === vid && b.eventId === eid && b.type === type && bookingLiveStatus(b) === "active"; });
  if (active) {
    var ranges = active.slots.map(function (i) { return slotRange(active.date, active.hour, i, type); });
    var now = new Date();
    var curRange = ranges.find(function (r) { return now >= r.start && now < r.end; });
    if (curRange) {
      var secs = Math.max(0, Math.floor((curRange.end - now) / 1000));
      return icon + " " + label + " live — " + Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0") + " left";
    }
  }
  var upcoming = getBookings().filter(function (b) { return b.vendorId === vid && b.eventId === eid && b.type === type && bookingLiveStatus(b) === "upcoming"; })
    .sort(function (a, b) { return a.hour - b.hour; })[0];
  if (upcoming) {
    var r = slotRange(upcoming.date, upcoming.hour, Math.min.apply(null, upcoming.slots), type);
    var now2 = new Date();
    var secs2 = Math.max(0, Math.floor((r.start - now2) / 1000));
    var hh = Math.floor(secs2 / 3600), mm = Math.floor((secs2 % 3600) / 60), ss = secs2 % 60;
    return icon + " " + label + " in " + (hh > 0 ? hh + "h " : "") + mm + "m " + ss + "s";
  }
  return "";
}

function renderDashCountdowns() {
  document.querySelectorAll(".dash-cd").forEach(function (el) {
    var vid = el.dataset.vid, eid = el.dataset.eid;
    var parts = [];
    var featuredText = promoCountdownText(vid, eid, "featured", "&#11088;", "Featured");
    var boostText = promoCountdownText(vid, eid, "boost", "&#128640;", "Boost");
    if (featuredText) parts.push(featuredText);
    if (boostText) parts.push(boostText);
    el.innerHTML = parts.length ? "<span class='countdown'>" + parts.join(" &middot; ") + "</span>" : "<span style='font-size:11px;color:rgba(90,65,30,.5);'>No active promo</span>";
  });
}

function updateDashNavVisibility() {
  var btn = document.getElementById("nDash");
  if (btn) btn.style.display = getMyVendorIds().length ? "inline-block" : "none";
}

/* ── Admin Dashboard tabs ── */

/* Every flyer across every category board, grouped by board, newest
   first within each group - the admin panel had no way to see all
   flyers at all before this (only Vendors/Bookings/Pricing/Hours). */
function renderAdminEvents() {
  var list = document.getElementById("adminEventsList");
  if (!list) return;
  list.innerHTML = "";
  if (!evts.length) { list.innerHTML = "<p class='aempty'>No flyers yet.</p>"; return; }

  ORD.forEach(function (cat) {
    var items = evts.filter(function (e) { return e.cat === cat; });
    if (!items.length) return;
    var groupHead = document.createElement("div");
    groupHead.style.cssText = "font-family:'Special Elite',monospace;color:var(--cl);font-size:13px;margin:14px 0 6px;";
    groupHead.textContent = (C[cat] ? C[cat].l : cat) + " (" + items.length + ")";
    list.appendChild(groupHead);

    items.forEach(function (ev) {
      var row = document.createElement("div");
      row.style.cssText = "background:rgba(253,246,224,.06);border:1px solid rgba(218,184,112,.2);border-radius:6px;padding:10px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;";
      var live = isLiveNow(ev);
      var name = document.createElement("div");
      name.style.cssText = "font-family:'Special Elite',monospace;font-size:12.5px;color:var(--cl);flex:1;min-width:160px;";
      name.innerHTML = escHtml(ev.t) + (live ? " <span style='color:#22c55e;font-weight:700;'>&#9679; LIVE</span>" : "") +
        "<br><span style='opacity:.65;font-size:10.5px;'>" + escHtml(ev.w || "") + (ev.exp ? " &middot; expired" : "") + "</span>";
      row.appendChild(name);

      var viewBtn = document.createElement("button"); viewBtn.className = "nb"; viewBtn.textContent = "View";
      viewBtn.onclick = function () { showBoards(); openDetail(ev.id); };
      var editBtn = document.createElement("button"); editBtn.className = "nb"; editBtn.textContent = "Edit";
      editBtn.onclick = function () { showBoards(); editEv(ev.id); };
      var removeBtn = document.createElement("button"); removeBtn.className = "nb"; removeBtn.textContent = "Remove";
      removeBtn.onclick = function () { if (confirm("Remove \"" + ev.t + "\"?")) { delEv(ev.id); renderAdminEvents(); } };
      row.appendChild(viewBtn); row.appendChild(editBtn); row.appendChild(removeBtn);
      list.appendChild(row);
    });
  });
}
function showAdminTab(tab) {
  document.querySelectorAll(".admintab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === tab); });
  var panels = { events: "adminTabEvents", vendors: "adminTabVendors", bookings: "adminTabBookings", pricing: "adminTabPricing", hours: "adminTabHours" };
  Object.keys(panels).forEach(function (t) {
    var el = document.getElementById(panels[t]);
    if (el) el.style.display = t === tab ? "block" : "none";
  });
  if (tab === "events") renderAdminEvents();
  if (tab === "vendors") renderAdminList();
  if (tab === "bookings") renderAdminBookings();
  if (tab === "pricing") renderAdminPricing();
  if (tab === "hours") renderAdminHours();
}

function renderAdminBookings() {
  var list = document.getElementById("adminBookingsList");
  if (!list) return;
  var all = getBookings().slice().sort(function (a, b) { return new Date(b.purchasedAt) - new Date(a.purchasedAt); });
  if (!all.length) { list.innerHTML = "<p class='aempty'>No bookings yet.</p>"; return; }
  list.innerHTML = "";
  all.forEach(function (b) {
    var v = vendors.find(function (x) { return x.id === b.vendorId; });
    var ev = evts.find(function (x) { return x.id === b.eventId; });
    var detail = b.date + " " + fmtHour(b.hour) + " hour, " +
      b.slots.slice().sort(function (a, c) { return a - c; }).map(function (i) { return slotTimeLabel(b.hour, i, b.type); }).join(", ");
    var status = b.status === "cancelled" ? "cancelled" : bookingLiveStatus(b);
    var row = document.createElement("div"); row.className = "abkrow";
    row.innerHTML = "<span style='flex:1;min-width:180px;'><b>" + escHtml(v ? v.name : "?") + "</b> &middot; " + escHtml(ev ? ev.t : "?") +
      "<br><span style='opacity:.65;font-size:10.5px;'>" + (b.type === "boost" ? "Boost" : "Featured") + " &middot; " + escHtml(detail) + " &middot; " + status + "</span></span>" +
      "<span class='abk-amt'>$" + b.amount + "</span>";
    if (b.status !== "cancelled") {
      var cancelBtn = document.createElement("button"); cancelBtn.className = "nb"; cancelBtn.textContent = "Cancel";
      cancelBtn.onclick = function () { if (confirm("Cancel this booking and free the slot?")) { cancelBooking(b.id); renderAdminBookings(); } };
      row.appendChild(cancelBtn);
    }
    list.appendChild(row);
  });
}

function renderAdminPricing() {
  var wrap = document.getElementById("adminPricingForm");
  if (!wrap) return;
  var pricing = getPricing();
  wrap.innerHTML = "<div class='aformgrid'>" +
    "<label>Boost price ($)<input id='priceBoost' type='number' min='0' step='1' value='" + pricing.boost + "'></label>" +
    "<label>Featured price ($)<input id='priceFeatured' type='number' min='0' step='1' value='" + pricing.featured + "'></label>" +
    "</div><button class='nb on' id='savePricingBtn'>Save Pricing</button>";
  document.getElementById("savePricingBtn").onclick = function () {
    var b = parseFloat(document.getElementById("priceBoost").value) || 0;
    var f = parseFloat(document.getElementById("priceFeatured").value) || 0;
    setPricing({ boost: b, featured: f });
    alert("Pricing updated.");
  };
}

function renderAdminHours() {
  var wrap = document.getElementById("adminHoursForm");
  if (!wrap) return;
  if (!evts.length) { wrap.innerHTML = "<p class='aempty'>No events yet.</p>"; return; }
  var opts = evts.map(function (ev) { return "<option value='" + ev.id + "'>" + escHtml(ev.t) + "</option>"; }).join("");
  wrap.innerHTML = "<div class='aformgrid'><label>Event<select id='hoursEventSel'>" + opts + "</select></label></div><div id='hoursGridWrap'></div>";
  var sel = document.getElementById("hoursEventSel");
  function draw() {
    var ev = evts.find(function (x) { return x.id === sel.value; });
    var gridWrap = document.getElementById("hoursGridWrap");
    if (!ev) { gridWrap.innerHTML = ""; return; }
    var hours = eventHourRange(ev);
    var closed = closedHoursFor(ev.id);
    var grid = hours.map(function (h) {
      var isClosed = closed.indexOf(h) >= 0;
      return "<button class='hourbtn" + (isClosed ? " closed" : " on") + "' data-hour='" + h + "'>" + fmtHour(h) + "<span class='hbstat'>" + (isClosed ? "Closed" : "Open") + "</span></button>";
    }).join("");
    gridWrap.innerHTML = "<p class='promo-sub' style='margin-top:10px;'>Tap an hour to open/close it for Boost booking.</p><div class='hourgrid'>" + grid + "</div>";
    gridWrap.querySelectorAll(".hourbtn").forEach(function (btn) {
      btn.onclick = function () { toggleHourClosed(ev.id, parseInt(btn.dataset.hour, 10)); draw(); };
    });
  }
  sel.onchange = draw;
  draw();
}

/* Re-renders whatever detail/admin/dashboard view is currently open so a
   just-purchased promotion (or a cross-tab change picked up via
   onPromoSync below) shows up immediately instead of needing a manual
   refresh. */
function refreshOpenViewsAfterPromo() {
  var dp = document.getElementById("detPanel");
  if (document.getElementById("detOv").classList.contains("on")) {
    if (dp.dataset.vid) openVendorDetail(dp.dataset.vid, dp.dataset.fromEvent || undefined);
    else if (dp.dataset.eid) openDetail(dp.dataset.eid);
  }
  if (document.getElementById("adminSec").style.display !== "none") {
    var activeTab = document.querySelector(".admintab.on");
    if (activeTab) showAdminTab(activeTab.dataset.tab);
  }
  if (document.getElementById("dashOv").classList.contains("on")) renderVendorDashboard();
}

onPromoSync(refreshOpenViewsAfterPromo);

document.addEventListener("DOMContentLoaded", function () {
  updateDashNavVisibility();
});
