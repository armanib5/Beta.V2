/* BayPinned admin tool: a private pin/zone editor, not linked from the
   public map. It edits an in-memory + localStorage-backed copy of the
   PLACES data and lets you export/download a replacement data/places.js -
   there's no backend yet, so nothing here is "live" until you paste the
   export over the real file and redeploy. */

var DRAFT_KEY = "baypinned-admin-draft-v1";
var workingPlaces = loadDraft();
var markerById = {};
var zoneLayerById = {};
var selectedId = null; // null means "creating a new pin"
var zoneMode = null;   // null | "adding" | "addingCorner" | "editing"
var zoneTargetId = null;
var touched = {}; // id -> "added" | "edited" | "deleted" (for the pending list)
var tempMarker = null; // draggable placeholder shown while creating a new pin, before Save

var storageBroken = false;

function loadDraft() {
  try {
    var raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { storageBroken = true; }
  return JSON.parse(JSON.stringify(PLACES));
}

/* Autosave silently failed before if localStorage.setItem threw - which it
   does on iOS Safari Private Browsing even for tiny strings, with zero
   visible error. Now every save updates an on-screen status line so you
   can actually see whether it worked instead of trusting it blindly. */
function saveDraft() {
  var el = document.getElementById("saveStatus");
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(workingPlaces));
    storageBroken = false;
    if (el) { el.textContent = "Autosaved to this browser at " + new Date().toLocaleTimeString(); el.className = "savestatus ok"; }
    return true;
  } catch (e) {
    storageBroken = true;
    if (el) { el.textContent = "Autosave is NOT working in this browser (private/incognito mode blocks it) - export or download before you close this tab, or your edits will be lost!"; el.className = "savestatus bad"; }
    return false;
  }
}

function catIcon(cat) {
  var info = CATS[cat] || { c: "#888" };
  var html = '<div style="width:26px;height:26px;border-radius:50%;background:' + info.c +
    ';border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.55);"></div>';
  return L.divIcon({ html: html, className: "", iconSize: [26, 26], iconAnchor: [13, 13] });
}

function populateSelects() {
  var catSel = document.getElementById("fCat");
  Object.keys(CATS).forEach(function (cat) {
    var opt = document.createElement("option");
    opt.value = cat; opt.textContent = CATS[cat].l;
    catSel.appendChild(opt);
  });
  var hoodSel = document.getElementById("fHood");
  CITIES.forEach(function (c) {
    var grp = document.createElement("optgroup");
    grp.label = c.l;
    c.hoods.forEach(function (h) {
      var opt = document.createElement("option");
      opt.value = h.id; opt.textContent = h.l;
      grp.appendChild(opt);
    });
    hoodSel.appendChild(grp);
  });
}

function buildMarker(place) {
  var m = L.marker([place.lat, place.lng], { icon: catIcon(place.cat), draggable: true });
  m.bindTooltip(place.t);
  m.on("click", function () {
    if (zoneMode === "adding" || zoneMode === "addingCorner") { handleMapClick({ latlng: m.getLatLng() }); return; }
    selectPlace(place.id);
  });
  m.on("dragend", function () {
    var ll = m.getLatLng();
    place.lat = round4(ll.lat); place.lng = round4(ll.lng);
    if (selectedId === place.id) {
      document.getElementById("fLat").value = place.lat;
      document.getElementById("fLng").value = place.lng;
    }
    touch(place.id, "edited");
    saveDraft();
  });
  markerById[place.id] = m;
  m.addTo(map);
}

function round4(n) { return Math.round(n * 10000) / 10000; }

function refreshZoneLayer(place) {
  if (zoneLayerById[place.id]) { map.removeLayer(zoneLayerById[place.id]); delete zoneLayerById[place.id]; }
  if (place.zone) {
    var poly = L.polygon(place.zone, { color: "#dc2626", weight: 2, dashArray: "6 4", fillColor: "#dc2626", fillOpacity: 0.22 });
    poly.addTo(map);
    zoneLayerById[place.id] = poly;
  }
}

function touch(id, kind) { touched[id] = kind; renderPendingList(); }
function renderPendingList() {
  var el = document.getElementById("pendingList");
  var keys = Object.keys(touched);
  if (!keys.length) { el.innerHTML = "No unsaved changes yet this session."; return; }
  el.innerHTML = keys.map(function (id) {
    var label = touched[id] === "deleted" ? id : ((workingPlaces.find(function (p) { return p.id === id; }) || {}).t || id);
    return "<span>" + touched[id] + ": " + label + "</span>";
  }).join("");
}

function clearForm() {
  ["fName","fAddr","fWhen","fDesc","fPk","fTr","fWeb","fEd"].forEach(function (id) { document.getElementById(id).value = ""; });
  document.getElementById("fRecur").value = "";
  document.getElementById("fSh").value = "";
  document.getElementById("fEh").value = "";
  document.getElementById("fCat").value = "market";
  document.getElementById("fHood").value = HOODS[0].id;
}

function selectPlace(id) {
  selectedId = id;
  exitZoneMode();
  clearTempMarker();
  document.getElementById("modeHint").textContent = "";
  var p = workingPlaces.find(function (x) { return x.id === id; });
  if (!p) return;
  document.getElementById("panelTitle").textContent = "Editing: " + p.t;
  document.getElementById("fCat").value = p.cat;
  document.getElementById("fHood").value = p.hood;
  document.getElementById("fName").value = p.t || "";
  document.getElementById("fAddr").value = p.a || "";
  document.getElementById("fLat").value = p.lat;
  document.getElementById("fLng").value = p.lng;
  document.getElementById("fWhen").value = p.w || "";
  document.getElementById("fRecur").value = p.d || "";
  document.getElementById("fSh").value = p.sh != null ? p.sh : "";
  document.getElementById("fEh").value = p.eh != null ? p.eh : "";
  document.getElementById("fEd").value = p.ed || "";
  document.getElementById("fWeb").value = p.wb || "";
  document.getElementById("fDesc").value = p.ds || "";
  document.getElementById("fPk").value = p.pk || "";
  document.getElementById("fTr").value = p.tr || "";
  document.getElementById("btnDelete").disabled = false;
}

function tempIcon() {
  var html = '<div style="width:30px;height:30px;border-radius:50%;background:rgba(184,134,11,.85);' +
    'border:3px dashed #fff;box-shadow:0 2px 8px rgba(0,0,0,.6);"></div>';
  return L.divIcon({ html: html, className: "", iconSize: [30, 30], iconAnchor: [15, 15] });
}

/* Starts a new pin at latlng AND drops a draggable placeholder marker
   there immediately, so you can drag it to the exact spot before ever
   touching the form - much easier on mobile than needing to click the
   precise right pixel among 40+ existing pins. */
function startNewPin(latlng) {
  selectedId = null;
  exitZoneMode();
  document.getElementById("modeHint").textContent = "Drag the gold dashed pin to the exact spot, then fill in the form and Save.";
  document.getElementById("panelTitle").textContent = "New pin (unsaved) - fill in the form and click Save Pin";
  clearForm();
  document.getElementById("fLat").value = round4(latlng.lat);
  document.getElementById("fLng").value = round4(latlng.lng);
  document.getElementById("btnDelete").disabled = true;

  if (tempMarker) map.removeLayer(tempMarker);
  tempMarker = L.marker(latlng, { icon: tempIcon(), draggable: true });
  tempMarker.on("dragend", function () {
    var ll = tempMarker.getLatLng();
    document.getElementById("fLat").value = round4(ll.lat);
    document.getElementById("fLng").value = round4(ll.lng);
  });
  tempMarker.addTo(map);
}

function clearTempMarker() {
  if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
}

function readForm() {
  var num = function (v) { return v === "" ? undefined : parseFloat(v); };
  var obj = {
    cat: document.getElementById("fCat").value,
    hood: document.getElementById("fHood").value,
    t: document.getElementById("fName").value.trim(),
    a: document.getElementById("fAddr").value.trim(),
    lat: parseFloat(document.getElementById("fLat").value),
    lng: parseFloat(document.getElementById("fLng").value),
    w: document.getElementById("fWhen").value.trim(),
    d: document.getElementById("fRecur").value || undefined,
    sh: num(document.getElementById("fSh").value),
    eh: num(document.getElementById("fEh").value),
    ed: document.getElementById("fEd").value || undefined,
    wb: document.getElementById("fWeb").value.trim() || undefined,
    ds: document.getElementById("fDesc").value.trim(),
    pk: document.getElementById("fPk").value.trim() || undefined,
    tr: document.getElementById("fTr").value.trim() || undefined
  };
  Object.keys(obj).forEach(function (k) { if (obj[k] === undefined) delete obj[k]; });
  return obj;
}

function savePin() {
  var data = readForm();
  if (!data.t) { alert("Name is required."); return; }
  /* Location isn't required to save - if you haven't placed it yet, it
     drops at the current map center and you can drag it into place (or
     fill in the details first, save, then drag) whenever you're ready. */
  if (isNaN(data.lat) || isNaN(data.lng)) {
    var c = map.getCenter();
    data.lat = round4(c.lat); data.lng = round4(c.lng);
    document.getElementById("fLat").value = data.lat;
    document.getElementById("fLng").value = data.lng;
  }
  if (selectedId) {
    var p = workingPlaces.find(function (x) { return x.id === selectedId; });
    if (!p) return;
    var oldZone = p.zone;
    Object.keys(p).forEach(function (k) { delete p[k]; });
    Object.assign(p, { id: selectedId }, data);
    if (oldZone) p.zone = oldZone;
    var m = markerById[selectedId];
    m.setLatLng([p.lat, p.lng]);
    m.setIcon(catIcon(p.cat));
    m.setTooltipContent(p.t);
    touch(selectedId, "edited");
  } else {
    var id = "u" + Date.now();
    var np = Object.assign({ id: id }, data);
    workingPlaces.push(np);
    buildMarker(np);
    clearTempMarker();
    selectedId = id;
    document.getElementById("btnDelete").disabled = false;
    touch(id, "added");
  }
  document.getElementById("modeHint").textContent = "";
  document.getElementById("panelTitle").textContent = "Editing: " + data.t;
  saveDraft();
}

function deletePin() {
  if (!selectedId) return;
  if (!confirm("Delete this pin?")) return;
  var id = selectedId;
  if (markerById[id]) { map.removeLayer(markerById[id]); delete markerById[id]; }
  if (zoneLayerById[id]) { map.removeLayer(zoneLayerById[id]); delete zoneLayerById[id]; }
  workingPlaces = workingPlaces.filter(function (p) { return p.id !== id; });
  touch(id, "deleted");
  selectedId = null;
  document.getElementById("panelTitle").textContent = "No pin selected";
  clearForm();
  document.getElementById("btnDelete").disabled = true;
  saveDraft();
}

/* Zone tool: any shape, not just a rectangle. Two flows:
   - No zone yet: click the map to add corners one at a time (3+ needed),
     then Finish Zone. Any polygon - triangle, pentagon, whatever the
     event footprint actually looks like.
   - Zone already exists: drops a draggable gold handle on every corner
     so you can drag any one of them to reshape it, plus "+ Add Corner"
     to click one more point onto the shape. */
var zoneDraftPoints = [];
var zoneDraftLayer = null;
var zoneHandles = [];

function startZone() {
  if (!selectedId) { alert("Select (or save) a pin first, then draw its zone."); return; }
  var p = workingPlaces.find(function (x) { return x.id === selectedId; });
  if (!p) return;
  if (p.zone && p.zone.length >= 3) enterZoneEditMode(p);
  else enterZoneAddMode(p);
}

function enterZoneAddMode(p) {
  zoneMode = "adding";
  zoneTargetId = p.id;
  zoneDraftPoints = [];
  clearZoneHandles();
  if (zoneDraftLayer) { map.removeLayer(zoneDraftLayer); zoneDraftLayer = null; }
  document.getElementById("modeHint").textContent = "Zone mode: click the map to add corners (3+ needed) - any shape, not just a rectangle. Then click Finish Zone.";
  document.getElementById("btnZoneFinish").style.display = "inline-block";
  document.getElementById("btnZoneFinish").disabled = true;
  document.getElementById("btnZoneAddCorner").style.display = "none";
  document.getElementById("btnZoneDone").style.display = "none";
}

function addZoneDraftPoint(latlng) {
  zoneDraftPoints.push([latlng.lat, latlng.lng]);
  if (zoneDraftLayer) map.removeLayer(zoneDraftLayer);
  zoneDraftLayer = L.polygon(zoneDraftPoints, { color: "#f59e0b", weight: 2, dashArray: "4 4", fillColor: "#f59e0b", fillOpacity: 0.15 });
  zoneDraftLayer.addTo(map);
  document.getElementById("btnZoneFinish").disabled = zoneDraftPoints.length < 3;
}

function finishZoneDraft() {
  if (zoneDraftPoints.length < 3) return;
  var p = workingPlaces.find(function (x) { return x.id === zoneTargetId; });
  if (p) {
    p.zone = zoneDraftPoints.slice();
    refreshZoneLayer(p);
    touch(p.id, "edited");
    saveDraft();
  }
  if (zoneDraftLayer) { map.removeLayer(zoneDraftLayer); zoneDraftLayer = null; }
  zoneDraftPoints = [];
  if (p) enterZoneEditMode(p);
}

function enterZoneEditMode(p) {
  zoneMode = "editing";
  zoneTargetId = p.id;
  document.getElementById("modeHint").textContent = "Zone mode: drag any gold corner to reshape it. \"+ Add Corner\" then click the map to add another point. Click Done when finished.";
  document.getElementById("btnZoneFinish").style.display = "none";
  document.getElementById("btnZoneAddCorner").style.display = "inline-block";
  document.getElementById("btnZoneDone").style.display = "inline-block";
  buildZoneHandles(p);
}

function buildZoneHandles(p) {
  clearZoneHandles();
  p.zone.forEach(function (pt, idx) {
    var h = L.marker(pt, {
      draggable: true,
      icon: L.divIcon({
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.6);"></div>',
        className: "", iconSize: [16, 16], iconAnchor: [8, 8]
      })
    });
    h.on("drag", function () {
      var ll = h.getLatLng();
      p.zone[idx] = [ll.lat, ll.lng];
      refreshZoneLayer(p);
    });
    h.on("dragend", function () { touch(p.id, "edited"); saveDraft(); });
    h.addTo(map);
    zoneHandles.push(h);
  });
}

function clearZoneHandles() {
  zoneHandles.forEach(function (h) { map.removeLayer(h); });
  zoneHandles = [];
}

function addZoneCorner() {
  if (zoneMode !== "editing") return;
  zoneMode = "addingCorner";
  document.getElementById("modeHint").textContent = "Click the map to append a new corner to this zone.";
}

function exitZoneMode() {
  zoneMode = null; zoneTargetId = null;
  if (zoneDraftLayer) { map.removeLayer(zoneDraftLayer); zoneDraftLayer = null; }
  zoneDraftPoints = [];
  clearZoneHandles();
  document.getElementById("btnZoneFinish").style.display = "none";
  document.getElementById("btnZoneAddCorner").style.display = "none";
  document.getElementById("btnZoneDone").style.display = "none";
  document.getElementById("modeHint").textContent = "";
}

function clearZone() {
  if (!selectedId) return;
  var p = workingPlaces.find(function (x) { return x.id === selectedId; });
  if (!p) return;
  delete p.zone;
  if (zoneLayerById[selectedId]) { map.removeLayer(zoneLayerById[selectedId]); delete zoneLayerById[selectedId]; }
  if (zoneTargetId === selectedId) exitZoneMode();
  touch(selectedId, "edited");
  saveDraft();
}

function handleMapClick(e) {
  if (zoneMode === "adding") { addZoneDraftPoint(e.latlng); return; }
  if (zoneMode === "addingCorner") {
    var p = workingPlaces.find(function (x) { return x.id === zoneTargetId; });
    if (p) {
      p.zone.push([e.latlng.lat, e.latlng.lng]);
      refreshZoneLayer(p);
      touch(p.id, "edited");
      saveDraft();
      enterZoneEditMode(p);
    }
    return;
  }
  startNewPin(e.latlng);
}

/* Every var this page loads from data/places.js at startup gets
   re-serialized here, not just the ones this tool's own UI edits
   (CATS/HOODS/PLACES) - otherwise a future addition to that file (like
   HOODS_SC/CITIES for the multi-city switcher) would silently vanish
   the next time someone exports, since it'd never have been read back
   out. If you add a new top-level var to places.js, add its name here
   too. */
var PLACES_JS_VARS = ["CATS", "CAT_ORDER", "HOODS", "HOODS_SC", "HOODS_SV", "HOODS_MV", "HOODS_CAMP", "CITIES"];

function generateFileContents() {
  var out = "";
  PLACES_JS_VARS.forEach(function (name) {
    if (typeof window[name] === "undefined") return;
    out += "var " + name + " = " + JSON.stringify(window[name], null, 2) + ";\n\n";
  });
  out += "var PLACES = " + JSON.stringify(workingPlaces, null, 2) + ";\n";
  return out;
}

/* Tries the modern clipboard API first (more reliable than execCommand,
   which is deprecated and blocked outright in some mobile browsers),
   falls back to the old select+execCommand trick, and either way shows a
   clear on-screen result instead of leaving you guessing whether it
   worked. The textarea below stays visible either way so you can select
   and copy by hand as a last resort. */
function copyToClipboardThen(text, confirmElId) {
  var el = document.getElementById(confirmElId);
  function ok() { if (el) { el.textContent = "Copied! Paste it into your next message to Claude."; el.className = "exportconfirm ok"; } }
  function fail() { if (el) { el.textContent = "Couldn't auto-copy - select the text in the box below and copy it manually, then paste it into your message to Claude."; el.className = "exportconfirm bad"; } }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok, function () {
      try { document.execCommand("copy"); ok(); } catch (e) { fail(); }
    });
  } else {
    try { document.execCommand("copy"); ok(); } catch (e) { fail(); }
  }
}

function exportData() {
  var box = document.getElementById("exportOut");
  box.value = generateFileContents();
  box.classList.add("show");
  box.select();
  copyToClipboardThen(box.value, "exportConfirm");
}

function downloadData() {
  var blob = new Blob([generateFileContents()], { type: "text/javascript" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = "places.js";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  var el = document.getElementById("exportConfirm");
  if (el) { el.textContent = "Downloaded places.js - send that file to Claude."; el.className = "exportconfirm ok"; }
}

function resetDraft() {
  if (!confirm("Discard your local draft and reload the original data from data/places.js?")) return;
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  location.reload();
}

/* ---------------------------------------------------------------------
   Events & Flyers - board-prep scaffolding, separate from map pins.
   Same local-draft-then-export pattern as pins, but no map is involved:
   this is a plain list + form. An event can optionally reference a pin
   by id (linkedPin) instead of duplicating lat/lng. ------------------- */

var EVENTS_DRAFT_KEY = "baypinned-admin-events-draft-v1";
var workingEvents = loadEventsDraft();
var selectedEventId = null;
var eventsTouched = {};

function loadEventsDraft() {
  try {
    var raw = localStorage.getItem(EVENTS_DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return JSON.parse(JSON.stringify(EVENTS));
}
function saveEventsDraft() {
  var el = document.getElementById("eventSaveStatus");
  try {
    localStorage.setItem(EVENTS_DRAFT_KEY, JSON.stringify(workingEvents));
    if (el) { el.textContent = "Autosaved to this browser at " + new Date().toLocaleTimeString(); el.className = "savestatus ok"; }
    return true;
  } catch (e) {
    if (el) { el.textContent = "Autosave is NOT working in this browser - export or download before you close this tab!"; el.className = "savestatus bad"; }
    return false;
  }
}

function populateEventSelects() {
  var catSel = document.getElementById("eCat");
  Object.keys(CATS).forEach(function (cat) {
    var opt = document.createElement("option");
    opt.value = cat; opt.textContent = CATS[cat].l;
    catSel.appendChild(opt);
  });
  var pinSel = document.getElementById("eLinkedPin");
  workingPlaces.forEach(function (p) {
    var opt = document.createElement("option");
    opt.value = p.id; opt.textContent = p.t;
    pinSel.appendChild(opt);
  });
}

function eventTouch(id, kind) { eventsTouched[id] = kind; renderEventsPendingList(); }
function renderEventsPendingList() {
  var el = document.getElementById("eventsPendingList");
  var keys = Object.keys(eventsTouched);
  if (!keys.length) { el.innerHTML = "No unsaved changes yet this session."; return; }
  el.innerHTML = keys.map(function (id) {
    var label = eventsTouched[id] === "deleted" ? id : ((workingEvents.find(function (e) { return e.id === id; }) || {}).t || id);
    return "<span>" + eventsTouched[id] + ": " + label + "</span>";
  }).join("");
}

function renderEventList() {
  var el = document.getElementById("eventList");
  if (!workingEvents.length) { el.innerHTML = '<div class="eventempty">No events yet - click "+ Add New Event" to create one.</div>'; return; }
  el.innerHTML = "";
  workingEvents.forEach(function (ev) {
    var info = CATS[ev.cat] || { l: ev.cat, c: "#666" };
    var card = document.createElement("div");
    card.className = "eventcard";
    card.innerHTML = '<span class="ecat" style="background:' + info.c + '">' + info.l + '</span>' +
      '<span class="etitle">' + ev.t + '</span><span class="ewhen">' + (ev.w || "") + '</span>';
    card.onclick = function () { selectEvent(ev.id); };
    el.appendChild(card);
  });
}

function clearEventForm() {
  ["eTitle","eLbl","eWhen","eAddr","ePhone","eWeb","eEd","eDesc","eTags","ePk","eTr","eAc","eFam"].forEach(function (id) {
    document.getElementById(id).value = "";
  });
  document.getElementById("eRecur").value = "";
  document.getElementById("eCat").value = "market";
  document.getElementById("eLinkedPin").value = "";
}

function showEventForm() { document.getElementById("eventForm").style.display = "block"; }
function hideEventForm() { document.getElementById("eventForm").style.display = "none"; }

function selectEvent(id) {
  selectedEventId = id;
  var ev = workingEvents.find(function (x) { return x.id === id; });
  if (!ev) return;
  document.getElementById("eventFormTitle").textContent = "Editing: " + ev.t;
  document.getElementById("eCat").value = ev.cat;
  document.getElementById("eLinkedPin").value = ev.linkedPin || "";
  document.getElementById("eTitle").value = ev.t || "";
  document.getElementById("eLbl").value = ev.lbl || "";
  document.getElementById("eWhen").value = ev.w || "";
  document.getElementById("eRecur").value = ev.d || "";
  document.getElementById("eAddr").value = ev.a || "";
  document.getElementById("ePhone").value = ev.ph || "";
  document.getElementById("eWeb").value = ev.wb || "";
  document.getElementById("eEd").value = ev.ed || "";
  document.getElementById("eDesc").value = ev.ds || "";
  document.getElementById("eTags").value = (ev.tags || []).join(", ");
  document.getElementById("ePk").value = ev.pk || "";
  document.getElementById("eTr").value = ev.tr || "";
  document.getElementById("eAc").value = ev.ac || "";
  document.getElementById("eFam").value = ev.fam || "";
  document.getElementById("btnDeleteEvent").disabled = false;
  showEventForm();
}

function startNewEvent() {
  selectedEventId = null;
  clearEventForm();
  document.getElementById("eventFormTitle").textContent = "New event (unsaved)";
  document.getElementById("btnDeleteEvent").disabled = true;
  showEventForm();
}

function readEventForm() {
  var tagsRaw = document.getElementById("eTags").value.trim();
  var obj = {
    cat: document.getElementById("eCat").value,
    linkedPin: document.getElementById("eLinkedPin").value || undefined,
    t: document.getElementById("eTitle").value.trim(),
    lbl: document.getElementById("eLbl").value.trim() || undefined,
    w: document.getElementById("eWhen").value.trim(),
    d: document.getElementById("eRecur").value || undefined,
    a: document.getElementById("eAddr").value.trim() || undefined,
    ph: document.getElementById("ePhone").value.trim() || undefined,
    wb: document.getElementById("eWeb").value.trim() || undefined,
    ed: document.getElementById("eEd").value || undefined,
    ds: document.getElementById("eDesc").value.trim(),
    tags: tagsRaw ? tagsRaw.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : undefined,
    pk: document.getElementById("ePk").value.trim() || undefined,
    tr: document.getElementById("eTr").value.trim() || undefined,
    ac: document.getElementById("eAc").value.trim() || undefined,
    fam: document.getElementById("eFam").value.trim() || undefined
  };
  Object.keys(obj).forEach(function (k) { if (obj[k] === undefined) delete obj[k]; });
  return obj;
}

function saveEvent() {
  var data = readEventForm();
  if (!data.t) { alert("Title is required."); return; }
  if (selectedEventId) {
    var ev = workingEvents.find(function (x) { return x.id === selectedEventId; });
    if (!ev) return;
    Object.keys(ev).forEach(function (k) { delete ev[k]; });
    Object.assign(ev, { id: selectedEventId }, data);
    eventTouch(selectedEventId, "edited");
  } else {
    var id = "ev" + Date.now();
    workingEvents.push(Object.assign({ id: id }, data));
    selectedEventId = id;
    document.getElementById("btnDeleteEvent").disabled = false;
    eventTouch(id, "added");
  }
  document.getElementById("eventFormTitle").textContent = "Editing: " + data.t;
  renderEventList();
  saveEventsDraft();
}

function deleteEvent() {
  if (!selectedEventId) return;
  if (!confirm("Delete this event?")) return;
  var id = selectedEventId;
  workingEvents = workingEvents.filter(function (e) { return e.id !== id; });
  eventTouch(id, "deleted");
  selectedEventId = null;
  clearEventForm();
  hideEventForm();
  renderEventList();
  saveEventsDraft();
}

function generateEventsFileContents() {
  return "var EVENTS = " + JSON.stringify(workingEvents, null, 2) + ";\n";
}
function exportEvents() {
  var box = document.getElementById("eventsExportOut");
  box.value = generateEventsFileContents();
  box.classList.add("show");
  box.select();
  copyToClipboardThen(box.value, "eventsExportConfirm");
}
function downloadEvents() {
  var blob = new Blob([generateEventsFileContents()], { type: "text/javascript" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = "events.js";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  var el = document.getElementById("eventsExportConfirm");
  if (el) { el.textContent = "Downloaded events.js - send that file to Claude."; el.className = "exportconfirm ok"; }
}
function resetEventsDraft() {
  if (!confirm("Discard your local events draft and reload the original data from data/events.js?")) return;
  try { localStorage.removeItem(EVENTS_DRAFT_KEY); } catch (e) {}
  location.reload();
}

function switchTab(tab) {
  var pinsOn = tab === "pins";
  document.getElementById("pinsSection").style.display = pinsOn ? "" : "none";
  document.getElementById("panel").style.display = pinsOn ? "" : "none";
  document.getElementById("eventsSection").style.display = pinsOn ? "none" : "";
  document.getElementById("tabPins").classList.toggle("on", pinsOn);
  document.getElementById("tabEvents").classList.toggle("on", !pinsOn);
  /* Leaflet mis-measures its container while it was display:none, so the
     map looks blank/offset the first time you switch back to this tab
     without this. */
  if (pinsOn && map) setTimeout(function () { map.invalidateSize(); }, 0);
}

var map;
function initAdmin() {
  var start = HOODS[0];
  map = L.map("adminMap", { center: [start.lat, start.lng], zoom: start.zoom });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: "abcd", maxZoom: 20
  }).addTo(map);

  populateSelects();
  clearForm();
  workingPlaces.forEach(function (p) { buildMarker(p); refreshZoneLayer(p); });
  renderPendingList();

  map.on("click", handleMapClick);
  document.getElementById("btnSave").onclick = savePin;
  document.getElementById("btnDelete").onclick = deletePin;
  document.getElementById("btnZoneStart").onclick = startZone;
  document.getElementById("btnZoneFinish").onclick = finishZoneDraft;
  document.getElementById("btnZoneAddCorner").onclick = addZoneCorner;
  document.getElementById("btnZoneDone").onclick = exitZoneMode;
  document.getElementById("btnZoneClear").onclick = clearZone;
  document.getElementById("btnCancel").onclick = function () {
    selectedId = null;
    exitZoneMode();
    clearTempMarker();
    document.getElementById("panelTitle").textContent = "No pin selected";
    document.getElementById("modeHint").textContent = "";
    clearForm();
    document.getElementById("btnDelete").disabled = true;
  };
  document.getElementById("btnAddHere").onclick = function () { startNewPin(map.getCenter()); };
  document.getElementById("btnExport").onclick = exportData;
  document.getElementById("btnDownload").onclick = downloadData;
  document.getElementById("btnResetDraft").onclick = resetDraft;
  document.getElementById("btnDelete").disabled = true;
  saveDraft(); // populate the save-status line immediately so you know up front if autosave works here

  populateEventSelects();
  clearEventForm();
  renderEventList();
  renderEventsPendingList();
  document.getElementById("btnAddEvent").onclick = startNewEvent;
  document.getElementById("btnSaveEvent").onclick = saveEvent;
  document.getElementById("btnDeleteEvent").onclick = deleteEvent;
  document.getElementById("btnCancelEvent").onclick = function () {
    selectedEventId = null;
    clearEventForm();
    hideEventForm();
  };
  document.getElementById("btnExportEvents").onclick = exportEvents;
  document.getElementById("btnDownloadEvents").onclick = downloadEvents;
  document.getElementById("btnResetEventsDraft").onclick = resetEventsDraft;
  document.getElementById("btnDeleteEvent").disabled = true;
  saveEventsDraft();

  document.getElementById("tabPins").onclick = function () { switchTab("pins"); };
  document.getElementById("tabEvents").onclick = function () { switchTab("events"); };
}

document.addEventListener("DOMContentLoaded", initAdmin);
