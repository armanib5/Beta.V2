/* Public "Add a Pin" page — drop a pin on the map, we reverse-geocode
   it (free Nominatim/OpenStreetMap API, no key needed) to fill in the
   address so people don't have to hunt for their own street address,
   then submit to the shared `pins` Supabase table with status
   'pending' for an admin to approve on /admin/. */

var pinMap, marker;

function init() {
  var gate = document.getElementById("sbGate");
  if (!isSupabaseConfigured()) {
    renderSupabaseNotConfigured(gate, "Adding a pin");
    return;
  }
  document.getElementById("pinApp").style.display = "block";

  pinMap = L.map("pinMap", { zoomControl: true, center: [37.3382, -121.8863], zoom: 15 });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: "abcd", maxZoom: 20
  }).addTo(pinMap);

  pinMap.on("click", function (e) { placeMarker(e.latlng); });

  document.getElementById("btnSubmitPin").onclick = submitPin;
  document.getElementById("btnClearPin").onclick = clearPin;
  drawEventZones();
  suggestExistingNames();
  prefillFromQuery();
}

/* Populates the name/title fields' suggestion lists from pins already
   submitted (any status) so someone placing themselves notices a
   lookalike already exists instead of quietly creating a duplicate. */
function suggestExistingNames() {
  var sb = getSupabase();
  sb.from("pins").select("title, owner_name").then(function (res) {
    if (res.error || !res.data) return;
    var titles = {}, owners = {};
    res.data.forEach(function (p) {
      if (p.title) titles[p.title] = true;
      if (p.owner_name) owners[p.owner_name] = true;
    });
    function esc(s) { return s.replace(/'/g, "&#39;"); }
    document.getElementById("pTitleList").innerHTML = Object.keys(titles).map(function (t) { return "<option value='" + esc(t) + "'>"; }).join("");
    document.getElementById("pOwnerList").innerHTML = Object.keys(owners).map(function (o) { return "<option value='" + esc(o) + "'>"; }).join("");
  });
}

/* Shows any active event's street-closure zone (drawn in map/admin.html)
   as a dashed reference outline, so someone placing their own pin can see
   where the event actually is instead of guessing from the address alone. */
function drawEventZones() {
  if (typeof PLACES === "undefined") return;
  PLACES.forEach(function (p) {
    if (!p.zone || p.zone.length < 3) return;
    L.polygon(p.zone, { color: "#f59e0b", weight: 2, dashArray: "5 5", fillColor: "#f59e0b", fillOpacity: 0.08 })
      .addTo(pinMap).bindTooltip(p.t, { permanent: false, direction: "center" });
  });
}

/* "Add to Map" on a flyer/vendor's own detail view links here with
   ?title=&addr=&cat= instead of making someone manually retype an
   address they already entered once - board flyers only ever store a
   free-text address (no real lat/lng), so this forward-geocodes it via
   the same Nominatim service /pins/ already uses in reverse. */
function prefillFromQuery() {
  var params = new URLSearchParams(location.search);
  var title = params.get("title"), addr = params.get("addr"), cat = params.get("cat");
  if (!addr) return;
  var hint = document.getElementById("locHint");
  document.getElementById("pinPanel").style.display = "block";
  hint.textContent = "Looking up " + addr + "…";
  fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(addr))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.length) { hint.textContent = "Couldn't find that address automatically - tap the map to place your pin."; return; }
      var latlng = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      pinMap.setView(latlng, 17);
      placeMarker(latlng);
      if (title) document.getElementById("pTitle").value = title;
      if (cat && document.querySelector("#pCat option[value='" + cat + "']")) document.getElementById("pCat").value = cat;
    })
    .catch(function () { hint.textContent = "Couldn't look up that address - tap the map to place your pin."; });
}

function placeMarker(latlng) {
  if (marker) pinMap.removeLayer(marker);
  marker = L.marker(latlng, { draggable: true }).addTo(pinMap);
  marker.on("dragend", function () { reverseGeocode(marker.getLatLng()); });
  document.getElementById("pinPanel").style.display = "block";
  reverseGeocode(latlng);
}

function reverseGeocode(latlng) {
  var hint = document.getElementById("locHint");
  var addrField = document.getElementById("pAddr");
  hint.textContent = "Looking up the address…";
  fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + latlng.lat + "&lon=" + latlng.lng + "&zoom=18")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var addr = data && data.display_name ? data.display_name : "";
      if (addr) addrField.value = addr;
      hint.textContent = "Pin placed — drag it to fine-tune, or tap elsewhere on the map.";
    })
    .catch(function () {
      hint.textContent = "Pin placed. Couldn't auto-fill the address — type it in below.";
    });
}

function clearPin() {
  if (marker) { pinMap.removeLayer(marker); marker = null; }
  document.getElementById("pinPanel").style.display = "none";
  ["pOwner", "pTitle", "pAddr", "pNote"].forEach(function (id) { document.getElementById(id).value = ""; });
}

function submitPin() {
  if (!marker) { alert("Tap the map to place your pin first."); return; }
  var owner = document.getElementById("pOwner").value.trim();
  var title = document.getElementById("pTitle").value.trim();
  if (!owner || !title) { alert("Please add your name/business and what's here."); return; }
  var latlng = marker.getLatLng();
  var status = document.getElementById("pinStatus");
  var btn = document.getElementById("btnSubmitPin");
  btn.disabled = true; btn.textContent = "Submitting…";

  var sb = getSupabase();
  var eventSel = document.getElementById("pEvent");
  var eventLabel = eventSel.options[eventSel.selectedIndex].text;
  var note = document.getElementById("pNote").value.trim();
  if (eventSel.value) note = "[" + eventLabel + "] " + note;

  sb.from("pins").insert({
    source: "vendor",
    cat_id: document.getElementById("pCat").value,
    owner_name: owner,
    title: title,
    description: note,
    lat: latlng.lat,
    lng: latlng.lng,
    status: "pending"
  }).then(function (res) {
    btn.disabled = false; btn.textContent = "Submit Pin";
    status.style.display = "block";
    if (res.error) {
      status.className = "savestatus bad";
      status.textContent = res.error.message;
    } else {
      status.className = "savestatus ok";
      status.textContent = "Submitted! An organizer will review it before it shows up on the map.";
      clearPin();
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
