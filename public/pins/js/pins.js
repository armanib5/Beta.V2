/* "Manage My Pin" page — edits a logged-in vendor's OWN business
   location (vendors.lat/lng in the V2 project) directly, instead of
   submitting to the old anonymous/admin-reviewed `pins` staging table
   (V1 project). That old flow let anyone drop a pin with no login at
   all, which is how stray/leftover pins (e.g. a one-off festival pin
   nobody ever cleaned up) accumulated with no owner to trace them back
   to. Requiring a real vendor session and writing straight to that
   vendor's own row means every pin on the map traces to a real account,
   and RLS ("vendor can update own profile") already allows this
   self-edit with no admin review needed.

   Session check uses readNextAuthSession() (shared/next-auth-bridge.js)
   instead of this page's own supabase-js client's getSession() - the
   real login happens on the Next.js app, which stores its session in a
   cookie via @supabase/ssr, not the localStorage this page's plain CDN
   client would otherwise check. Every request below sends that real
   access token directly as a Bearer header instead of going through a
   supabase-js client instance at all. */

var pinMap, marker, session, currentVendor;

function init() {
  if (typeof V2_SUPABASE_URL === "undefined") {
    document.getElementById("loginGateMsg").textContent = "This page isn't connected yet — see supabase/README.md.";
    document.getElementById("loginGate").style.display = "block";
    return;
  }
  session = readNextAuthSession();
  if (!session) {
    document.getElementById("loginGate").style.display = "block";
    return;
  }
  fetch(V2_SUPABASE_URL + "/rest/v1/vendors?id=eq." + encodeURIComponent(session.userId) + "&select=*", {
    headers: { apikey: V2_SUPABASE_ANON_KEY, Authorization: "Bearer " + session.accessToken }
  }).then(function (r) { return r.json(); }).then(function (rows) {
    if (!Array.isArray(rows) || !rows.length) {
      document.getElementById("loginGateMsg").textContent = "Couldn't find a business account for this login.";
      document.getElementById("loginGate").style.display = "block";
      return;
    }
    currentVendor = rows[0];
    startPinEditor();
  }).catch(function () {
    document.getElementById("loginGateMsg").textContent = "Couldn't reach the server — check your connection and reload.";
    document.getElementById("loginGate").style.display = "block";
  });
}

function startPinEditor() {
  document.getElementById("pinApp").style.display = "block";
  document.getElementById("pinHeading").textContent = "Pin for " + currentVendor.business_name;
  document.getElementById("pinIntro").textContent =
    "Tap the map (or drag the pin) to set exactly where " + currentVendor.business_name + "'s pin shows on CityPinned's map.";

  var hasPin = currentVendor.lat !== null && currentVendor.lng !== null;
  var center = hasPin ? { lat: currentVendor.lat, lng: currentVendor.lng } : { lat: 37.3382, lng: -121.8863 };

  pinMap = L.map("pinMap", { zoomControl: true, center: center, zoom: hasPin ? 16 : 12 });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 20
  }).addTo(pinMap);

  pinMap.on("click", function (e) { placeMarker(e.latlng); });

  if (hasPin) placeMarker(center, true);

  document.getElementById("btnSubmitPin").onclick = savePin;
  document.getElementById("btnClearPin").onclick = clearPin;
}

function placeMarker(latlng, skipGeocode) {
  if (marker) pinMap.removeLayer(marker);
  marker = L.marker(latlng, { draggable: true }).addTo(pinMap);
  marker.on("dragend", function () { reverseGeocode(marker.getLatLng()); });
  document.getElementById("pinPanel").style.display = "block";
  if (!skipGeocode) reverseGeocode(latlng);
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
  document.getElementById("pAddr").value = "";
}

function savePin() {
  if (!marker) { alert("Tap the map to place your pin first."); return; }
  var latlng = marker.getLatLng();
  var status = document.getElementById("pinStatus");
  var btn = document.getElementById("btnSubmitPin");
  btn.disabled = true; btn.textContent = "Saving…";

  fetch(V2_SUPABASE_URL + "/rest/v1/vendors?id=eq." + encodeURIComponent(currentVendor.id), {
    method: "PATCH",
    headers: {
      apikey: V2_SUPABASE_ANON_KEY, Authorization: "Bearer " + session.accessToken,
      "Content-Type": "application/json", Prefer: "return=minimal"
    },
    body: JSON.stringify({ lat: latlng.lat, lng: latlng.lng, location_verified_at: new Date().toISOString() })
  }).then(function (res) {
    btn.disabled = false; btn.textContent = "Save My Pin";
    status.style.display = "block";
    if (!res.ok) {
      status.className = "savestatus bad";
      status.textContent = "Couldn't save — please try again.";
    } else {
      status.className = "savestatus ok";
      status.textContent = "Saved! Your pin is updated on the map.";
      currentVendor.lat = latlng.lat;
      currentVendor.lng = latlng.lng;
    }
  }).catch(function () {
    btn.disabled = false; btn.textContent = "Save My Pin";
    status.style.display = "block";
    status.className = "savestatus bad";
    status.textContent = "Couldn't reach the server — please try again.";
  });
}

document.addEventListener("DOMContentLoaded", init);
