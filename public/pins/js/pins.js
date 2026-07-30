/* "Update My Pin" page — edits a logged-in vendor's OWN business_name
   location (vendors.lat/lng in the V2 project) directly, instead of
   submitting to the old anonymous/admin-reviewed `pins` staging table
   (V1 project). That old flow let anyone drop a pin with no login at
   all, which is how stray/leftover pins (e.g. a one-off festival pin
   nobody ever cleaned up) accumulated with no owner to trace them back
   to. Requiring a real vendor session and writing straight to that
   vendor's own row means every pin on the map traces to a real account,
   and RLS ("vendor can update own profile") already allows this
   self-edit with no admin review needed. */

var pinMap, marker, v2sb, currentVendor;

function init() {
  if (typeof V2_SUPABASE_URL === "undefined" || typeof supabase === "undefined") {
    document.getElementById("loginGateMsg").textContent = "This page isn't connected yet — see supabase/README.md.";
    document.getElementById("loginGate").style.display = "block";
    return;
  }
  v2sb = supabase.createClient(V2_SUPABASE_URL, V2_SUPABASE_ANON_KEY);
  v2sb.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    if (!session) {
      document.getElementById("loginGate").style.display = "block";
      return;
    }
    v2sb.from("vendors").select("*").eq("id", session.user.id).single().then(function (vRes) {
      if (vRes.error || !vRes.data) {
        document.getElementById("loginGateMsg").textContent = "Couldn't find a business account for this login.";
        document.getElementById("loginGate").style.display = "block";
        return;
      }
      currentVendor = vRes.data;
      startPinEditor();
    });
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

  v2sb.from("vendors").update({ lat: latlng.lat, lng: latlng.lng }).eq("id", currentVendor.id).then(function (res) {
    btn.disabled = false; btn.textContent = "Save My Pin";
    status.style.display = "block";
    if (res.error) {
      status.className = "savestatus bad";
      status.textContent = res.error.message;
    } else {
      status.className = "savestatus ok";
      status.textContent = "Saved! Your pin is updated on the map.";
      currentVendor.lat = latlng.lat;
      currentVendor.lng = latlng.lng;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
