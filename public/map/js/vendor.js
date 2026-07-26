/* Vendor self check-in tool: separate from the owner's admin.html. A
   vendor can only add/edit/delete pins tagged with their own name, only
   while the event they're checking into is actually live right now, and
   those pins clear themselves out the day after - so a weekly farmers
   market's vendor lineup doesn't carry over to the next occurrence.
   Still pre-backend: same local-draft-then-export-to-Claude workflow as
   the owner's tools. */

var VENDOR_DRAFT_KEY = "baypinned-vendor-draft-v1";
var VENDOR_NAME_KEY = "baypinned-vendor-name";
var workingVendorPins = loadVendorDraft();
var selectedEventPlace = null;
var selectedVendorPinId = null;
var vmap, vTempMarker = null, vMarkersById = {};

function todayStr() { return new Date().toISOString().slice(0, 10); }

/* Same live-window rules as map.js, duplicated here since this page has
   its own map instance and doesn't load map.js. */
function isTodayPlace(p) {
  if (!p.d) return false;
  var d = new Date(), dn = ["sun","mon","tue","wed","thu","fri","sat"][d.getDay()];
  if (p.d === "daily" || p.d === "today") return true;
  if (p.d === dn) return true;
  if (p.d === "monthly") {
    if (d.getDay() !== 5) return false;
    var f = new Date(d.getFullYear(), d.getMonth(), 1);
    while (f.getDay() !== 5) f.setDate(f.getDate() + 1);
    return d.getDate() === f.getDate();
  }
  if (p.d.length === 10) return p.d === d.toISOString().slice(0, 10);
  return false;
}
function isLive(p) {
  if (p.ed && p.ed < todayStr()) return false;
  if (!isTodayPlace(p)) return false;
  if (p.sh != null && p.eh != null) {
    var now = new Date(), h = now.getHours() + now.getMinutes() / 60;
    if (h < p.sh || h > p.eh) return false;
  }
  return true;
}

function pruneStale(list) { return list.filter(function (p) { return p.addedDate === todayStr(); }); }

function loadVendorDraft() {
  try {
    var raw = localStorage.getItem(VENDOR_DRAFT_KEY);
    if (raw) return pruneStale(JSON.parse(raw));
  } catch (e) {}
  return pruneStale(JSON.parse(JSON.stringify(VENDOR_PINS)));
}
function saveVendorDraft() {
  var el = document.getElementById("vSaveStatus");
  try {
    localStorage.setItem(VENDOR_DRAFT_KEY, JSON.stringify(workingVendorPins));
    if (el) { el.textContent = "Autosaved to this browser at " + new Date().toLocaleTimeString(); el.className = "savestatus ok"; }
    return true;
  } catch (e) {
    if (el) { el.textContent = "Autosave is NOT working in this browser - export before you close this tab or your pin will be lost!"; el.className = "savestatus bad"; }
    return false;
  }
}

function ownerName() { return document.getElementById("vOwner").value.trim(); }

function renderLiveEvents() {
  var wrap = document.getElementById("liveEventsList");
  var live = PLACES.filter(isLive);
  if (!live.length) {
    wrap.innerHTML = '<div class="eventempty">No events are live right now. Check back during an event\'s actual hours (e.g. the farmers market, Wednesdays 9am-1:30pm).</div>';
    return;
  }
  wrap.innerHTML = "";
  live.forEach(function (p) {
    var info = CATS[p.cat] || { l: p.cat, c: "#666" };
    var card = document.createElement("div");
    card.className = "eventcard";
    card.innerHTML = '<span class="ecat" style="background:' + info.c + '">' + info.l + '</span>' +
      '<span class="etitle">' + p.t + '</span><span class="ewhen">' + (p.w || "") + '</span>';
    card.onclick = function () { openCheckin(p); };
    wrap.appendChild(card);
  });
}

function dotIcon(color) {
  return L.divIcon({
    html: '<div style="width:22px;height:22px;border-radius:50%;background:' + color + ';border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.55);"></div>',
    className: "", iconSize: [22, 22], iconAnchor: [11, 11]
  });
}

function openCheckin(place) {
  if (!ownerName()) { alert("Enter your name or business name first."); return; }
  selectedEventPlace = place;
  document.getElementById("checkinTitle").textContent = "Checking in: " + place.t;
  document.getElementById("checkinArea").style.display = "block";
  document.getElementById("vpanel").style.display = "block";
  cancelVendorForm();
  refreshVendorMap(place);
}

function refreshVendorMap(place) {
  if (!vmap) {
    vmap = L.map("vendorMap", { center: [place.lat, place.lng], zoom: 18 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: "abcd", maxZoom: 20
    }).addTo(vmap);
    vmap.on("click", function (e) { if (selectedEventPlace) startVendorPin(e.latlng); });
  } else {
    setTimeout(function () { vmap.invalidateSize(); vmap.setView([place.lat, place.lng], 18); }, 0);
  }
  Object.keys(vMarkersById).forEach(function (id) { vmap.removeLayer(vMarkersById[id]); });
  vMarkersById = {};

  if (place.zone) {
    L.polygon(place.zone, { color: "#dc2626", weight: 2, dashArray: "6 4", fillColor: "#dc2626", fillOpacity: 0.15, interactive: false }).addTo(vmap);
  }
  /* interactive:false on the reference pin and other vendors' pins - the
     map is centered exactly on the event's own coordinates, so that
     marker sits dead center at the most likely spot someone taps to drop
     their own pin. Without this it silently swallows the click instead
     of the map ever seeing it (same class of bug as the admin zone tool
     intercepting clicks on existing pins). */
  L.marker([place.lat, place.lng], { icon: dotIcon("#b8860b"), interactive: false }).addTo(vmap).bindTooltip(place.t, { permanent: false });

  workingVendorPins.filter(function (vp) { return vp.eventId === place.id; }).forEach(function (vp) {
    var mine = vp.owner.toLowerCase() === ownerName().toLowerCase();
    var m = L.marker([vp.lat, vp.lng], { icon: dotIcon(mine ? "#10b981" : "#64748b"), draggable: mine, interactive: mine });
    if (mine) m.bindTooltip(vp.owner + " (you)" + (vp.t ? " - " + vp.t : ""));
    else m.bindTooltip(vp.owner + (vp.t ? " - " + vp.t : ""), { permanent: true, direction: "top", className: "vendor-label", offset: [0, -10] });
    if (mine) {
      m.on("click", function () { selectVendorPin(vp.id); });
      m.on("dragend", function () {
        var ll = m.getLatLng();
        vp.lat = Math.round(ll.lat * 10000) / 10000; vp.lng = Math.round(ll.lng * 10000) / 10000;
        saveVendorDraft();
      });
    }
    vMarkersById[vp.id] = m;
    m.addTo(vmap);
  });
}

function startVendorPin(latlng) {
  selectedVendorPinId = null;
  document.getElementById("vFormTitle").textContent = "New check-in pin (unsaved)";
  document.getElementById("vWhat").value = "";
  document.getElementById("vNote").value = "";
  document.getElementById("btnDeleteVendorPin").disabled = true;
  if (vTempMarker) vmap.removeLayer(vTempMarker);
  vTempMarker = L.marker(latlng, { icon: dotIcon("#f59e0b"), draggable: true });
  vTempMarker.addTo(vmap);
}

function selectVendorPin(id) {
  var vp = workingVendorPins.find(function (x) { return x.id === id; });
  if (!vp) return;
  if (vp.owner.toLowerCase() !== ownerName().toLowerCase()) return; // only your own pins are editable
  selectedVendorPinId = id;
  if (vTempMarker) { vmap.removeLayer(vTempMarker); vTempMarker = null; }
  document.getElementById("vFormTitle").textContent = "Editing your pin";
  document.getElementById("vWhat").value = vp.t || "";
  document.getElementById("vNote").value = vp.ds || "";
  document.getElementById("btnDeleteVendorPin").disabled = false;
}

function saveVendorPin() {
  var what = document.getElementById("vWhat").value.trim();
  if (!what) { alert("Say what you're offering."); return; }
  if (!selectedEventPlace) return;
  if (selectedVendorPinId) {
    var vp = workingVendorPins.find(function (x) { return x.id === selectedVendorPinId; });
    if (vp) { vp.t = what; vp.ds = document.getElementById("vNote").value.trim(); }
  } else {
    if (!vTempMarker) { alert("Click the map to place your pin first."); return; }
    var ll = vTempMarker.getLatLng();
    var id = "vp" + Date.now();
    workingVendorPins.push({
      id: id, eventId: selectedEventPlace.id, owner: ownerName(),
      t: what, ds: document.getElementById("vNote").value.trim(),
      lat: Math.round(ll.lat * 10000) / 10000, lng: Math.round(ll.lng * 10000) / 10000,
      addedDate: todayStr()
    });
    selectedVendorPinId = id;
    vmap.removeLayer(vTempMarker); vTempMarker = null;
  }
  saveVendorDraft();
  refreshVendorMap(selectedEventPlace);
  document.getElementById("vFormTitle").textContent = "Editing your pin";
  document.getElementById("btnDeleteVendorPin").disabled = false;
}

function deleteVendorPin() {
  if (!selectedVendorPinId) return;
  if (!confirm("Remove your pin?")) return;
  workingVendorPins = workingVendorPins.filter(function (p) { return p.id !== selectedVendorPinId; });
  selectedVendorPinId = null;
  saveVendorDraft();
  refreshVendorMap(selectedEventPlace);
  cancelVendorForm();
}

function cancelVendorForm() {
  selectedVendorPinId = null;
  if (vTempMarker && vmap) { vmap.removeLayer(vTempMarker); vTempMarker = null; }
  document.getElementById("vFormTitle").textContent = "New check-in pin (unsaved)";
  document.getElementById("vWhat").value = "";
  document.getElementById("vNote").value = "";
  document.getElementById("btnDeleteVendorPin").disabled = true;
}

function generateVendorFileContents() {
  return "var VENDOR_PINS = " + JSON.stringify(workingVendorPins, null, 2) + ";\n";
}

function copyToClipboardThen(text, confirmElId) {
  var el = document.getElementById(confirmElId);
  function ok() { if (el) { el.textContent = "Copied! Paste it into your next message to Claude."; el.className = "exportconfirm ok"; } }
  function fail() { if (el) { el.textContent = "Couldn't auto-copy - select the text below and copy it manually."; el.className = "exportconfirm bad"; } }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok, function () {
      try { document.execCommand("copy"); ok(); } catch (e) { fail(); }
    });
  } else {
    try { document.execCommand("copy"); ok(); } catch (e) { fail(); }
  }
}
function exportVendorPins() {
  var box = document.getElementById("vExportOut");
  box.value = generateVendorFileContents();
  box.classList.add("show");
  box.select();
  copyToClipboardThen(box.value, "vExportConfirm");
}
function downloadVendorPins() {
  var blob = new Blob([generateVendorFileContents()], { type: "text/javascript" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = "vendorpins.js";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  var el = document.getElementById("vExportConfirm");
  if (el) { el.textContent = "Downloaded vendorpins.js - send that file to Claude."; el.className = "exportconfirm ok"; }
}

function initVendorPage() {
  var savedName = "";
  try { savedName = localStorage.getItem(VENDOR_NAME_KEY) || ""; } catch (e) {}
  document.getElementById("vOwner").value = savedName;
  document.getElementById("vOwner").addEventListener("change", function () {
    try { localStorage.setItem(VENDOR_NAME_KEY, ownerName()); } catch (e) {}
    if (selectedEventPlace) refreshVendorMap(selectedEventPlace);
  });

  renderLiveEvents();

  document.getElementById("btnSaveVendorPin").onclick = saveVendorPin;
  document.getElementById("btnDeleteVendorPin").onclick = deleteVendorPin;
  document.getElementById("btnCancelVendorPin").onclick = cancelVendorForm;
  document.getElementById("btnExportVendor").onclick = exportVendorPins;
  document.getElementById("btnDownloadVendor").onclick = downloadVendorPins;
  document.getElementById("btnDeleteVendorPin").disabled = true;
  saveVendorDraft();

  document.querySelectorAll(".infobtn").forEach(function (btn) {
    btn.onclick = function () { alert(btn.dataset.info); };
  });
}

document.addEventListener("DOMContentLoaded", initVendorPage);
