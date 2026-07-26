/* BayPinned interactive map — Leaflet-based, replaces the old hand-drawn
   SVG map while keeping the wood-frame/gold vintage container around it. */

var ICONS = {
  leaf: "\u{1F343}", fork: "\u{1F374}", cup: "\u{1F378}", palette: "\u{1F3A8}",
  art: "\u{1F5BC}", mask: "\u{1F3AD}", star: "⭐", bag: "\u{1F6CD}",
  P: "P", restroom: "\u{1F6BB}", train: "\u{1F686}",
  school: "\u{1F3EB}", hospital: "\u{1F3E5}", church: "⛪", plate: "\u{1F37D}\u{FE0F}", hotel: "\u{1F3E8}"
};

var map, clusterGroup, userMarker, activeCity = "sj", activeHood = "downtown", activeCat = "all";
var markerById = {};
var zoneLayers = {};
var userLoc = null;

/* A place is "live" only while its schedule says it's actually happening
   right now (mirrors Baypinned3's isToday/expire logic) - so a Wednesday
   farmers market only glows live on Wednesdays, not every day. Places with
   no `d` schedule (theaters, parking, transit, schools...) are standing
   locations rather than scheduled events, so they never show as live. */
/* Local calendar date (YYYY-MM-DD), not UTC - toISOString() jumps to
   tomorrow's date the moment UTC crosses midnight, which is still
   mid-afternoon for Pacific visitors and was expiring/hiding today's
   event hours before it actually ended locally. */
function todayLocal() {
  var d = new Date(), pad = function (n) { return n < 10 ? "0" + n : "" + n; };
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
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
  if (p.d.length === 10) return p.d === todayLocal();
  return false;
}
/* If a place gives an sh/eh (start hour/end hour, 24hr decimal) window -
   e.g. the farmers market's 9:00am-1:30pm is sh:9, eh:13.5 - it's only
   live during those hours on the right day, not all day just because the
   day matches. Places without sh/eh (the World Cup's "all matches" span,
   for instance) stay live for the whole day. */
function isLive(p) {
  if (p.ed && p.ed < todayLocal()) return false;
  if (!isTodayPlace(p)) return false;
  if (p.sh != null && p.eh != null) {
    var now = new Date(), h = now.getHours() + now.getMinutes() / 60;
    if (h < p.sh || h > p.eh) return false;
  }
  return true;
}

function pinDivIcon(p) {
  var info = CATS[p.cat] || { c: "#666", icon: "leaf" };
  var glyph = ICONS[info.icon] || "\u{1F4CD}";
  var live = isLive(p);
  var html =
    '<div class="bp-pin' + (live ? ' bp-live' : '') + '">' +
    (live ? '<div class="bp-livering"></div>' : '') +
    '<svg width="34" height="44" viewBox="0 0 34 44">' +
    '<path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27s17-14.3 17-27C34 7.6 26.4 0 17 0z" ' +
    'fill="' + info.c + '" stroke="#fff" stroke-width="2"/>' +
    '<circle cx="17" cy="17" r="11" fill="rgba(255,255,255,.92)"/>' +
    '</svg>' +
    '<div class="bp-glyph">' + glyph + '</div>' +
    (live ? '<div class="bp-livedot"></div>' : '') +
    '</div>';
  return L.divIcon({ html: html, className: "", iconSize: [34, 44], iconAnchor: [17, 44], popupAnchor: [0, -40] });
}

function clusterIcon(cluster) {
  var count = cluster.getChildCount();
  var size = count < 10 ? "small" : count < 25 ? "medium" : "large";
  var px = size === "small" ? 40 : size === "medium" ? 50 : 60;
  return L.divIcon({
    html: '<div class="bp-cluster ' + size + '">' + count + '</div>',
    className: "", iconSize: [px, px]
  });
}

function haversine(lat1, lng1, lat2, lng2) {
  var R = 3958.8, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function flyerHtml(p) {
  var info = CATS[p.cat] || { l: p.cat, c: "#666" };
  var mu = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.a || p.t);
  var distLine = "";
  if (userLoc) {
    var d = haversine(userLoc.lat, userLoc.lng, p.lat, p.lng);
    distLine = "<div><b>Distance:</b> " + d.toFixed(1) + " mi from you</div>";
  }
  var html = '<div class="bp-card">';
  html += '<span class="bp-cat" style="background:' + info.c + '">' + info.l + '</span>';
  if (isLive(p)) html += ' <span class="bp-livebadge">LIVE NOW</span>';
  html += '<h3>' + p.t + '</h3>';
  if (p.ds) html += '<div class="bp-desc">' + p.ds + '</div>';
  html += '<div class="bp-meta">';
  if (p.a) html += '<div><b>Address:</b> ' + p.a + '</div>';
  html += distLine;
  if (p.pk) html += '<div><b>Parking:</b> ' + p.pk + '</div>';
  if (p.tr) html += '<div><b>Transit:</b> ' + p.tr + '</div>';
  html += '</div>';
  html += '<div class="bp-btnrow">';
  html += '<a class="bp-btn blue" href="' + mu + '" target="_blank" rel="noopener">Directions</a>';
  html += '<button class="bp-btn gold" onclick="showFullDetail(\'' + p.id + '\')">Full Details</button>';
  if (p.wb) html += '<a class="bp-btn purple" href="' + p.wb + '" target="_blank" rel="noopener">Website</a>';
  html += '</div></div>';
  return html;
}

/* The "hanging flyer" info card: a single flyer clothes-pinned to a string
   near the top of the map, replacing Leaflet's default popup bubble so it
   behaves identically (and reliably) on desktop and mobile alike. */
function showFlyer(p) {
  document.getElementById("flyerContent").innerHTML = flyerHtml(p);
  document.getElementById("flyerWrap").classList.add("show");
}
function hideFlyer() {
  document.getElementById("flyerWrap").classList.remove("show");
}

/* Full-screen detail view - everything the flyer card has, laid out with
   more room, reached via the flyer's "Full Details" button. This is the
   whole record for a pin until the board (with photos, tags, vendor
   groups etc.) exists to plug richer data in. */
function showFullDetail(id) {
  var p = PLACES.find(function (x) { return x.id === id; });
  if (!p) return;
  var info = CATS[p.cat] || { l: p.cat, c: "#666" };
  var mu = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.a || p.t);
  function box(label, val) { return val ? '<div class="dibox"><h4>' + label + '</h4><p>' + val + '</p></div>' : ""; }
  var html = '<button class="xbtn" id="detailClose">&times;</button>';
  html += '<span class="dcat" style="background:' + info.c + '">' + info.l + '</span>';
  if (isLive(p)) html += ' <span class="bp-livebadge">LIVE NOW</span>';
  html += '<h2>' + p.t + '</h2>';
  if (p.w) html += '<div class="dwhen">' + p.w + '</div>';
  if (p.ds) html += '<p class="ddesc">' + p.ds + '</p>';
  html += '<div class="digrid">';
  html += box("Address", p.a);
  html += box("Parking", p.pk);
  html += box("Transit", p.tr);
  if (userLoc) html += box("Distance", haversine(userLoc.lat, userLoc.lng, p.lat, p.lng).toFixed(1) + " mi from you");
  if (p.ed) html += box("Ends", p.ed);
  html += '</div>';
  html += '<div class="dbtnrow">';
  html += '<a class="bp-btn blue" href="' + mu + '" target="_blank" rel="noopener">Directions</a>';
  if (p.wb) html += '<a class="bp-btn purple" href="' + p.wb + '" target="_blank" rel="noopener">Website</a>';
  html += '<a class="bp-btn gold" href="../board/index.html?openFlyer=' + encodeURIComponent(p.t) + '">View/Edit on Board</a>';
  html += '</div>';
  document.getElementById("detailPanel").innerHTML = html;
  document.getElementById("detailOv").classList.add("on");
  document.getElementById("detailClose").onclick = hideFullDetail;
}
function hideFullDetail() {
  document.getElementById("detailOv").classList.remove("on");
}
document.getElementById("detailOv").addEventListener("click", function (e) {
  if (e.target.id === "detailOv") hideFullDetail();
});

function addPlaceMarker(p) {
  var m = L.marker([p.lat, p.lng], { icon: pinDivIcon(p) });
  m.bpPlace = p;
  m.on("click", function () { showFlyer(p); });
  markerById[p.id] = m;
}

function buildMarkers() {
  /* disableClusteringAtZoom guarantees every pin becomes individually
     visible and clickable once zoomed in far enough, even when two pins
     sit almost on top of each other (e.g. an event pin and that same
     venue's restroom pin) - without it they'd stay clustered together
     at any zoom, since they're only meters apart. */
  clusterGroup = L.markerClusterGroup({ iconCreateFunction: clusterIcon, maxClusterRadius: 50, disableClusteringAtZoom: 18 });
  PLACES.forEach(addPlaceMarker);
  map.addLayer(clusterGroup);
}

/* Nearest hood (by straight-line distance) to a lat/lng, searched across
   every city - used to slot Supabase-approved pins (which don't carry a
   `hood` field) into the same neighborhood filtering the static PLACES
   already use. */
function nearestHood(lat, lng) {
  var best = null, bestDist = Infinity;
  CITIES.forEach(function (c) {
    c.hoods.forEach(function (h) {
      var d = haversine(lat, lng, h.lat, h.lng);
      if (d < bestDist) { bestDist = d; best = { city: c.id, hood: h.id }; }
    });
  });
  return best || { city: "sj", hood: "downtown" };
}

/* Approved pins (added via /admin/'s Pins tab or the public /pins/ page)
   live in Supabase, but this map only ever read the static PLACES array -
   approving a pin never made it appear here. Fetched once after the
   static map is already up and merged in as new markers, so approving in
   /admin/ actually shows up on the live map instead of only updating a
   database row nobody sees. */
function loadApprovedPins() {
  if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) return Promise.resolve();
  var sb = getSupabase();
  return sb.from("pins").select("*").eq("status", "approved").then(function (res) {
    if (res.error || !res.data || !res.data.length) return;
    res.data.forEach(function (p) {
      var loc = nearestHood(p.lat, p.lng);
      var place = {
        id: "sb-" + p.id, cat: p.cat_id || "shop", hood: loc.hood,
        t: p.title || p.owner_name || "Vendor Pin",
        a: p.owner_name || "", ds: p.description || "",
        lat: p.lat, lng: p.lng
      };
      PLACES.push(place);
      addPlaceMarker(place);
    });
    updateLegendCounts();
    applyFilters();
  });
}

/* A vendor's "Find on Our Map" button lands here with ?q=<name> instead
   of jumping straight to /pins/ to create a new pin - this runs the same
   search the search box does (now that live-approved pins are loaded)
   so an already-pinned vendor gets found instead of duplicated. Waits
   for loadApprovedPins() so a pin someone else just submitted is
   actually in PLACES by the time this searches it. */
function handleSearchQuery() {
  var params = new URLSearchParams(location.search);
  var q = params.get("q");
  if (!q) return;
  var input = document.getElementById("msInput"), clear = document.getElementById("msClear");
  if (input) {
    input.value = q;
    if (clear) clear.classList.add("show");
    input.dispatchEvent(new Event("input"));
  }
  var matches = PLACES.filter(function (p) { return p.t.toLowerCase().indexOf(q.toLowerCase()) >= 0; });
  if (matches.length === 1) selectPlace(matches[0]);
}

/* Builds a red "active zone" outline for any place that defines one (a
   street closure footprint, e.g. an ArtWalk or a farmers market) - kept
   off the map until updateZones() decides it should be showing. */
function buildZones() {
  PLACES.forEach(function (p) {
    if (!p.zone) return;
    var poly = L.polygon(p.zone, {
      color: "#dc2626", weight: 2, dashArray: "6 4",
      fillColor: "#dc2626", fillOpacity: 0.22
    });
    poly.bindTooltip(p.t + " - active now", { sticky: true });
    zoneLayers[p.id] = { poly: poly, place: p };
  });
}

/* A zone only shows while its place is both in the current
   neighborhood/city AND actually live right now (isLive) - so the
   Farmers Market's footprint appears Wednesday mornings and disappears
   the rest of the week, same idea as the pulsing "live" pins. */
function updateZones() {
  Object.keys(zoneLayers).forEach(function (id) {
    var z = zoneLayers[id];
    var shouldShow = z.place.hood === activeHood && isLive(z.place);
    var onMap = map.hasLayer(z.poly);
    if (shouldShow && !onMap) z.poly.addTo(map);
    if (!shouldShow && onMap) map.removeLayer(z.poly);
  });
}

/* Rebuilds the visible marker set using MarkerClusterGroup's bulk
   clearLayers()/addLayers() API. Earlier this looped eachLayer+removeLayer,
   which Leaflet explicitly documents as unsafe to do mid-iteration — that
   was corrupting the cluster group's internal spatial index over repeated
   calls and could leave markers stuck invisible/unclickable. */
function applyFilters() {
  var toShow = PLACES.filter(function (p) {
    return p.hood === activeHood && (activeCat === "all" || p.cat === activeCat);
  }).map(function (p) { return markerById[p.id]; });
  clusterGroup.clearLayers();
  clusterGroup.addLayers(toShow);
  updateLegendCounts();
  updateZones();
}

/* Legend numbers always reflect the current neighborhood/city regardless
   of the active category filter, so you can see at a glance how many of
   each type are around before deciding what to filter to - 0 stays
   visible rather than hiding the row, per request. */
function updateLegendCounts() {
  var counts = {};
  PLACES.forEach(function (p) {
    if (p.hood !== activeHood) return;
    counts[p.cat] = (counts[p.cat] || 0) + 1;
    if (isLive(p)) counts.live = (counts.live || 0) + 1;
  });
  document.querySelectorAll("#mapLegend .li[data-cat]").forEach(function (row) {
    var n = counts[row.dataset.cat] || 0;
    row.querySelector(".ld").textContent = n;
    row.style.opacity = n ? "1" : ".45";
  });
}

/* Cancels any in-flight flyTo before starting a new one. Firing a second
   flyTo while the first is still animating can leave Leaflet's internal
   zoom-animation flag stuck on, which in turn stops MarkerClusterGroup
   from ever swapping its "mid-zoom" placeholder icons back to real,
   clickable markers — exactly the "pins vanish / clicks do nothing after
   Locate then Reset" bug. */
function flyTo(lat, lng, zoom) {
  map.stop();
  map.flyTo([lat, lng], zoom, { duration: 1 });
}

function setAreaLabel(label, hasPlaces) {
  document.getElementById("mapTitle").textContent = label + " Map";
  var note = document.getElementById("mapNote");
  if (hasPlaces) { note.style.display = "none"; }
  else { note.textContent = "Events coming soon for " + label + ". Be the first to post a flyer!"; note.style.display = "block"; }
}

/* Every city carries its own list of hoods (CITIES, from places.js) -
   picking a city swaps the whole neighborhood row below it rather than
   revealing a second row alongside San Jose's. */
function activeCityObj() { return CITIES.find(function (c) { return c.id === activeCity; }); }
function findCityForHood(hoodId) {
  for (var i = 0; i < CITIES.length; i++) {
    var h = CITIES[i].hoods.find(function (x) { return x.id === hoodId; });
    if (h) return { city: CITIES[i], hood: h };
  }
  return null;
}
function hoodHasPlaces(hoodId) { return PLACES.some(function (p) { return p.hood === hoodId; }); }

function goToHood(h) {
  document.querySelectorAll(".hoodbtn").forEach(function (x) { x.classList.remove("on"); });
  var btn = document.querySelector('.hoodbtn[data-hood-id="' + h.id + '"]');
  if (btn) btn.classList.add("on");
  activeHood = h.id;
  setAreaLabel(h.l, hoodHasPlaces(h.id));
  flyTo(h.lat, h.lng, h.zoom);
  applyFilters();
  hideFlyer();
}

function renderHoodRow() {
  var row = document.getElementById("hoodRow");
  row.innerHTML = "";
  activeCityObj().hoods.forEach(function (h) {
    var b = document.createElement("button");
    b.className = "hoodbtn" + (h.id === activeHood ? " on" : "");
    b.dataset.hoodId = h.id;
    b.textContent = h.l;
    b.onclick = function () { goToHood(h); };
    row.appendChild(b);
  });
}

function initCityRow() {
  var row = document.getElementById("cityRow");
  CITIES.forEach(function (c) {
    var b = document.createElement("button");
    b.className = "citytab" + (c.id === activeCity ? " on" : "");
    b.dataset.cityId = c.id;
    b.textContent = c.l;
    b.onclick = function () {
      if (activeCity === c.id) return;
      document.querySelectorAll(".citytab").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      activeCity = c.id;
      renderHoodRow();
      goToHood(c.hoods[0]);
    };
    row.appendChild(b);
  });
}

function initFilterRow() {
  var row = document.getElementById("filtRow");
  var all = document.createElement("button");
  all.className = "filtbtn on"; all.textContent = "All"; all.dataset.cat = "all";
  all.onclick = function () { setActiveFilter(all, "all"); };
  row.appendChild(all);
  CAT_ORDER.forEach(function (cat) {
    var info = CATS[cat];
    var b = document.createElement("button");
    b.className = "filtbtn";
    b.dataset.cat = cat;
    b.innerHTML = '<span class="filtdot" style="background:' + info.c + '"></span>' + info.l;
    b.onclick = function () { setActiveFilter(b, cat); };
    row.appendChild(b);
  });
}
function setActiveFilter(btn, cat) {
  document.querySelectorAll(".filtbtn").forEach(function (x) { x.classList.remove("on"); });
  btn.classList.add("on");
  activeCat = cat;
  applyFilters();
  if (cat !== "all") flyToNearest(cat);
}

/* Tapping a category filter used to just hide every other pin and leave
   you wherever you happened to be looking - if that spot wasn't near a
   match, you'd end up staring at empty street with no sense of which way
   to go. Now it re-centers on the closest matching pin (closest to your
   real location if My Location is on, otherwise closest to whatever the
   map is currently showing), so pressing "Transit" or "Restrooms" always
   drops you next to one instead of just filtering blind. */
function flyToNearest(cat) {
  var anchor = userLoc || map.getCenter();
  var candidates = PLACES.filter(function (p) { return p.hood === activeHood && p.cat === cat; });
  if (!candidates.length) return;
  var nearest = null, nearestDist = Infinity;
  candidates.forEach(function (p) {
    var d = haversine(anchor.lat, anchor.lng, p.lat, p.lng);
    if (d < nearestDist) { nearestDist = d; nearest = p; }
  });
  flyTo(nearest.lat, nearest.lng, Math.max(map.getZoom(), 17));
  setTimeout(function () { showFlyer(nearest); }, 350);
}

function initSearch() {
  var input = document.getElementById("msInput"), results = document.getElementById("msResults"), clear = document.getElementById("msClear");
  function render(q) {
    q = q.trim().toLowerCase();
    if (!q) { results.classList.remove("show"); return; }
    var matches = PLACES.filter(function (p) { return p.t.toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
    results.innerHTML = "";
    if (!matches.length) {
      results.innerHTML = '<div class="msempty">No matches</div>';
    } else {
      matches.forEach(function (p) {
        var info = CATS[p.cat] || { c: "#666", l: p.cat };
        var row = document.createElement("div");
        row.className = "msrow";
        row.innerHTML = '<span class="msdot" style="background:' + info.c + '"></span><span class="msname">' + p.t + '</span><span class="mstype">' + info.l + '</span>';
        row.onclick = function () { selectPlace(p); results.classList.remove("show"); input.value = p.t; };
        results.appendChild(row);
      });
    }
    results.classList.add("show");
  }
  input.addEventListener("input", function () {
    clear.classList.toggle("show", !!input.value);
    render(input.value);
  });
  clear.addEventListener("click", function () { input.value = ""; clear.classList.remove("show"); results.classList.remove("show"); });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".mapsearch")) results.classList.remove("show");
  });
}

function selectPlace(p) {
  if (activeHood !== p.hood) {
    var found = findCityForHood(p.hood);
    if (found) {
      if (activeCity !== found.city.id) {
        activeCity = found.city.id;
        document.querySelectorAll(".citytab").forEach(function (x) { x.classList.toggle("on", x.dataset.cityId === activeCity); });
        renderHoodRow();
      }
      goToHood(found.hood);
    }
  }
  document.querySelectorAll(".filtbtn").forEach(function (x) { x.classList.remove("on"); });
  document.querySelector('.filtbtn[data-cat="all"]').classList.add("on");
  activeCat = "all";
  applyFilters();
  flyTo(p.lat, p.lng, 18);
  setTimeout(function () { showFlyer(p); }, 350);
}

function locateUser() {
  if (!navigator.geolocation) { alert("Geolocation is not supported on this device."); return; }
  navigator.geolocation.getCurrentPosition(function (pos) {
    userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.circleMarker([userLoc.lat, userLoc.lng], {
      radius: 8, color: "#fff", weight: 2, fillColor: "#2c5f8a", fillOpacity: 1
    }).addTo(map);
    flyTo(userLoc.lat, userLoc.lng, 16);
  }, function () {
    alert("Could not get your location. Check location permissions.");
  }, { enableHighAccuracy: true, timeout: 8000 });
}

/* Asks for location the moment the map opens (rather than waiting for
   someone to notice and press "My Location"), so the map centers on
   what's actually around them instead of always defaulting to Downtown
   San Jose. Silent on denial/unavailable - the default view just stands,
   no nagging alert like the manual My Location button gives. */
function promptLocationOnLoad() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(function (pos) {
    userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.circleMarker([userLoc.lat, userLoc.lng], {
      radius: 8, color: "#fff", weight: 2, fillColor: "#2c5f8a", fillOpacity: 1
    }).addTo(map);
    var loc = nearestHood(userLoc.lat, userLoc.lng);
    if (loc.city !== activeCity) {
      activeCity = loc.city;
      document.querySelectorAll(".citytab").forEach(function (x) { x.classList.toggle("on", x.dataset.cityId === activeCity); });
      renderHoodRow();
    }
    var hoodObj = activeCityObj().hoods.find(function (h) { return h.id === loc.hood; });
    if (hoodObj) {
      activeHood = hoodObj.id;
      document.querySelectorAll(".hoodbtn").forEach(function (x) { x.classList.toggle("on", x.dataset.hoodId === activeHood); });
      setAreaLabel(hoodObj.l, hoodHasPlaces(hoodObj.id));
      applyFilters();
    }
    flyTo(userLoc.lat, userLoc.lng, 16);
  }, function () {}, { enableHighAccuracy: true, timeout: 8000 });
}

function initLegend() {
  var lg = document.getElementById("mapLegend");
  CAT_ORDER.forEach(function (cat) {
    var info = CATS[cat];
    var row = document.createElement("div");
    row.className = "li";
    row.dataset.cat = cat;
    row.innerHTML = '<div class="ld" style="background:' + info.c + '">0</div>' + info.l;
    lg.appendChild(row);
  });
  var liveRow = document.createElement("div");
  liveRow.className = "li";
  liveRow.dataset.cat = "live";
  liveRow.innerHTML = '<div class="ld" style="background:#10b981">0</div>Live Now';
  lg.appendChild(liveRow);
}

function initMap() {
  var start = HOODS[0];
  map = L.map("leafletMap", { zoomControl: false, center: [start.lat, start.lng], zoom: start.zoom });
  /* Voyager (rather than plain Positron) keeps the same clean light look
     but renders street names with much more contrast at higher zooms. */
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: "abcd", maxZoom: 20
  }).addTo(map);

  buildMarkers();
  buildZones();
  initLegend();
  applyFilters();
  initCityRow();
  renderHoodRow();
  initFilterRow();
  initSearch();
  loadApprovedPins().then(handleSearchQuery);

  document.getElementById("zIn").onclick = function () { map.stop(); map.zoomIn(); };
  document.getElementById("zOut").onclick = function () { map.stop(); map.zoomOut(); };
  document.getElementById("zReset").onclick = function () { flyTo(start.lat, start.lng, start.zoom); };
  document.getElementById("myLoc").onclick = locateUser;
  document.getElementById("flyerClose").onclick = hideFlyer;
  map.on("click", hideFlyer);
  if (!openPlaceFromQuery()) promptLocationOnLoad();
}

/* Board's flyer detail links here with ?showPlace=<id> for events that
   already have a real pin (see app.js's "Find on Our Map" button) -
   opens straight to that pin instead of defaulting to the location
   prompt, so a flyer's map button always lands on the one real pin
   rather than ever inviting a duplicate submission. */
function openPlaceFromQuery() {
  var params = new URLSearchParams(location.search);
  var id = params.get("showPlace");
  if (!id) return false;
  var p = PLACES.find(function (x) { return x.id === id; });
  if (!p) return false;
  var loc = nearestHood(p.lat, p.lng);
  if (loc.city !== activeCity) {
    activeCity = loc.city;
    document.querySelectorAll(".citytab").forEach(function (x) { x.classList.toggle("on", x.dataset.cityId === activeCity); });
    renderHoodRow();
  }
  var hoodObj = activeCityObj().hoods.find(function (h) { return h.id === loc.hood; });
  if (hoodObj) {
    activeHood = hoodObj.id;
    document.querySelectorAll(".hoodbtn").forEach(function (x) { x.classList.toggle("on", x.dataset.hoodId === activeHood); });
    setAreaLabel(hoodObj.l, hoodHasPlaces(hoodObj.id));
    applyFilters();
  }
  flyTo(p.lat, p.lng, 18);
  setTimeout(function () { showFlyer(p); }, 400);
  return true;
}

document.addEventListener("DOMContentLoaded", initMap);
