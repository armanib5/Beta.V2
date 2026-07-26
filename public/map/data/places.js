/* Place + pin data for the BayPinned / Pinned SJ interactive map.
   Coordinates are real-world lat/lng (WGS84) for San Jose, CA — this
   replaces the old hand-drawn SVG's fictional 0-1100/0-720 mx/my grid.
   Coordinates for named downtown landmarks (Plaza de Cesar Chavez,
   Diridon Station, San Pedro Square Market, SoFA Market, MLK Library,
   Circle of Palms) were cross-checked against public map listings.
   Neighborhood sample pins (Japantown/Santana Row/Willow Glen/Alum
   Rock/East San Jose) are placeholder locations for that area, not
   confirmed single-business addresses — swap in real data before launch. */

var CATS = {
  "market": { "l": "Markets", "c": "#3d6b42", "icon": "leaf" },
  "foodhall": { "l": "Food Hall / Market", "c": "#b8860b", "icon": "fork" },
  "restaurants": { "l": "Restaurants", "c": "#e0662f", "icon": "plate" },
  "bars": { "l": "Bars", "c": "#6b1e3c", "icon": "cup" },
  "artwalk": { "l": "Arts", "c": "#2c5f8a", "icon": "palette" },
  "cityart": { "l": "Community Art", "c": "#6a4e7a", "icon": "art" },
  "venue": { "l": "Theaters", "c": "#7a5230", "icon": "mask" },
  "holiday": { "l": "Holiday", "c": "#8B0000", "icon": "star" },
  "shop": { "l": "Shops", "c": "#c0392b", "icon": "bag" },
  "parking": { "l": "Parking", "c": "#2c5f8a", "icon": "P" },
  "restrooms": { "l": "Restrooms", "c": "#64748b", "icon": "restroom" },
  "transit": { "l": "Transit", "c": "#1f8a4c", "icon": "train" },
  "schools": { "l": "Schools", "c": "#0ea5e9", "icon": "school" },
  "hospitals": { "l": "Hospitals", "c": "#dc2626", "icon": "hospital" },
  "churches": { "l": "Churches", "c": "#7c3aed", "icon": "church" },
  "hotels": { "l": "Hotels", "c": "#0f766e", "icon": "hotel" }
};

/* Order controls the category filter row. */
var CAT_ORDER = ["market","foodhall","restaurants","bars","artwalk","cityart","venue","holiday","shop","parking","restrooms","transit","schools","hospitals","churches","hotels"];

var HOODS = [
  { "id": "downtown", "l": "Downtown San Jose", "lat": 37.3382, "lng": -121.8863, "zoom": 15 },
  { "id": "japantown", "l": "Japantown", "lat": 37.3497, "lng": -121.8917, "zoom": 16 },
  { "id": "santana", "l": "Santana Row & Valley Fair", "lat": 37.3199, "lng": -121.9492, "zoom": 15 },
  { "id": "willow", "l": "Willow Glen", "lat": 37.3066, "lng": -121.8897, "zoom": 15 },
  { "id": "alum", "l": "Alum Rock", "lat": 37.3563, "lng": -121.8248, "zoom": 15 },
  { "id": "east", "l": "East San Jose", "lat": 37.3444, "lng": -121.8394, "zoom": 14 }
];

/* Every other Bay Area city gets its own small set of "mini city" areas,
   same idea as San Jose's neighborhood row - these are approximate,
   general-area coordinates (not geocode-verified like the downtown SJ
   cluster), meant as reasonable starting points to refine later. */
var HOODS_SC = [
  { id: "sc-downtown", l: "Downtown Santa Clara", lat: 37.3541, lng: -121.9552, zoom: 15 },
  { id: "sc-rivermark", l: "Rivermark",            lat: 37.3853, lng: -121.9645, zoom: 15 }
];
var HOODS_SV = [
  { id: "sv-downtown", l: "Downtown Sunnyvale", lat: 37.3688, lng: -122.0363, zoom: 15 },
  { id: "sv-moffett",  l: "Moffett Park",        lat: 37.4085, lng: -122.0525, zoom: 14 }
];
var HOODS_MV = [
  { id: "mv-downtown",  l: "Downtown Mountain View", lat: 37.3894, lng: -122.0832, zoom: 15 },
  { id: "mv-shoreline", l: "Shoreline",              lat: 37.4048, lng: -122.0784, zoom: 14 }
];
var HOODS_CAMP = [
  { id: "camp-downtown",  l: "Downtown Campbell", lat: 37.2872, lng: -121.9500, zoom: 15 },
  { id: "camp-pruneyard", l: "Pruneyard",          lat: 37.2932, lng: -121.9447, zoom: 15 }
];

/* Top-level city switcher - each city carries its own list of mini
   cities/neighborhoods, so picking a different city swaps the whole
   neighborhood row instead of just adding a second one alongside it. */
var CITIES = [
  { id: "sj",   l: "San Jose",       hoods: HOODS },
  { id: "sc",   l: "Santa Clara",    hoods: HOODS_SC },
  { id: "sv",   l: "Sunnyvale",      hoods: HOODS_SV },
  { id: "mv",   l: "Mountain View",  hoods: HOODS_MV },
  { id: "camp", l: "Campbell",       hoods: HOODS_CAMP }
];

var PLACES = [
  {
    "id": "fm",
    "cat": "market",
    "hood": "downtown",
    "t": "Downtown SJ Farmers Market",
    "a": "Paseo de San Antonio (near 3rd St), San Jose, CA 95113",
    "lat": 37.3336,
    "lng": -121.8868,
    "w": "Wednesdays 9:00am - 1:30pm",
    "d": "wed",
    "sh": 9,
    "eh": 13.5,
    "wb": "https://sjdowntown.com/downtown-farmers-market/",
    "ds": "Over 20 local farms and vendors every Wednesday on Paseo de San Antonio.",
    "pk": "ParkSJ garage 90 min free. Entrances on 2nd and 3rd Street.",
    "tr": "VTA Light Rail Convention Center stop, 5 min walk.",
    "zone": [
      [37.33378979886197, -121.88721299171452],
      [37.33326089553215, -121.88686430454256],
      [37.33344146241017, -121.88584685325623],
      [37.333640512008984, -121.88598096370697],
      [37.333458523825016, -121.88653349876404],
      [37.33386941839558, -121.886887550354]
    ]
  },
  {
    "id": "sm", "cat": "foodhall", "hood": "downtown",
    "t": "SoFA Market", "w": "Open Daily 11am - 9pm", "d": "daily", "sh": 11, "eh": 21,
    "a": "387 S 1st St, San Jose, CA 95113",
    "lat": 37.3302, "lng": -121.8864,
    "ds": "A permanent downtown food hall with multiple restaurants and a craft cocktail bar.",
    "pk": "Street parking on 1st and 2nd. ParkSJ on 2nd Street.",
    "tr": "VTA Route 65/68 on 1st Street.",
    "wb": "https://sofamarketsj.com"
  },
  {
    "id": "wc", "cat": "holiday", "hood": "downtown",
    "t": "Soccer Celebration - World Cup Watch Party", "w": "June 11 - July 19, all matches live", "d": "today", "ed": "2026-07-19",
    "a": "San Pedro Square Market, 87 N San Pedro St, San Jose, CA 95110",
    "lat": 37.3365, "lng": -121.8943,
    "ds": "Bay Area's largest free World Cup watch party on multiple jumbo screens.",
    "pk": "San Pedro Street garage nearby.",
    "tr": "VTA Route 522 on Santa Clara St.",
    "wb": "https://sanpedrosquaremarket.com"
  },
  {
    "id": "aw", "cat": "artwalk", "hood": "downtown",
    "t": "South First Fridays ArtWalk",
    "a": "South 1st Street, SoFA District, San Jose, CA",
    "lat": 37.3313, "lng": -121.8869,
    "w": "First Friday Monthly, 5pm - 9pm", "d": "monthly", "sh": 17, "eh": 21,
    "wb": "https://southfirstfridays.com",
    "ds": "Free self-guided evening art walk through downtown galleries, museums, and pop-up installations.",
    "pk": "Street parking on S 1st/2nd/3rd. Free after 6pm in many garages.",
    "tr": "VTA Route 65/68. Walk south from Convention Center light rail.",
    "zone": [
      [37.32774842063718, -121.88445210456848],
      [37.32800436084695, -121.88401579856874],
      [37.33152487214223, -121.88670516014099],
      [37.33127463122837, -121.88725233078003]
    ]
  },
  {
    "id": "gs", "cat": "cityart", "hood": "downtown",
    "t": "Gaiascope at Circle of Palms", "w": "May 22 - Aug 18, always open",
    "a": "Circle of Palms Plaza, 127 S Market St, San Jose, CA 95113",
    "lat": 37.3334, "lng": -121.8896,
    "ds": "Three suspended kaleidoscope sculptures by artist Brooke Einbender.",
    "pk": "Market Street garage one block north.",
    "tr": "VTA Convention Center stop, 2 min walk.",
    "wb": "https://www.sanjoseca.gov"
  },
  {
    "id": "ht", "cat": "venue", "hood": "downtown",
    "t": "Hammer Theatre Center", "w": "Box office hours vary",
    "a": "101 Paseo de San Antonio, San Jose, CA 95113",
    "lat": 37.3336, "lng": -121.8864,
    "ds": "Premier performing arts venue on Paseo de San Antonio, part of SJSU.",
    "pk": "ParkSJ garages on 2nd and 3rd Street.",
    "tr": "VTA light rail Convention Center stop, 5 min walk.",
    "wb": "https://www.hammertheatre.com"
  },
  {
    "id": "ct", "cat": "venue", "hood": "downtown",
    "t": "California Theatre", "w": "Box office hours vary",
    "a": "345 S 1st St, San Jose, CA 95113",
    "lat": 37.3307, "lng": -121.8869,
    "ds": "Restored 1927 Spanish Colonial Revival theater. Home to Opera San Jose and Symphony Silicon Valley.",
    "pk": "Street parking on 1st and 2nd.",
    "tr": "VTA Route 65/68 on 1st Street.",
    "wb": "https://www.sanjosetheaters.org"
  },
  {
    "id": "cp", "cat": "venue", "hood": "downtown",
    "t": "Center for the Performing Arts", "w": "Box office hours vary",
    "a": "255 Almaden Blvd, San Jose, CA 95113",
    "lat": 37.3305, "lng": -121.8918,
    "ds": "Major performing arts center hosting Broadway shows, concerts, and dance.",
    "pk": "Adjacent garages. Convention Center garage nearby.",
    "tr": "VTA Convention Center light rail stop, 5 min walk.",
    "wb": "https://www.sanjosetheaters.org"
  },
  { "id": "pk1", "cat": "parking", "hood": "downtown", "t": "ParkSJ 2nd Street Garage", "a": "2nd St, San Jose, CA", "lat": 37.3362, "lng": -121.8855, "ds": "City parking garage, 2nd Street entrance." },
  { "id": "pk2", "cat": "parking", "hood": "downtown", "t": "ParkSJ 3rd Street Garage", "a": "3rd St, San Jose, CA", "lat": 37.3361, "lng": -121.8834, "ds": "City parking garage, 3rd Street entrance." },
  { "id": "pk3", "cat": "parking", "hood": "downtown", "t": "San Pedro Square Garage", "a": "San Pedro St, San Jose, CA", "lat": 37.3374, "lng": -121.8936, "ds": "Garage adjacent to San Pedro Square Market." },
  { "id": "pk4", "cat": "parking", "hood": "downtown", "t": "Convention Center Parking", "a": "Convention Center, San Jose, CA", "lat": 37.3302, "lng": -121.8881, "ds": "Parking at the San Jose Convention Center." },
  { "id": "rr1", "cat": "restrooms", "hood": "downtown", "t": "Plaza de Cesar Chavez Restrooms", "a": "Plaza de Cesar Chavez, San Jose, CA", "lat": 37.3321, "lng": -121.8893, "ds": "Public restrooms in the park." },
  { "id": "rr2", "cat": "restrooms", "hood": "downtown", "t": "San Pedro Square Market Restrooms", "a": "87 N San Pedro St, San Jose, CA", "lat": 37.3369, "lng": -121.8949, "ds": "Restrooms inside the market." },
  { "id": "rr3", "cat": "restrooms", "hood": "downtown", "t": "SoFA Market Restrooms", "a": "387 S 1st St, San Jose, CA", "lat": 37.3305, "lng": -121.8867, "ds": "Restrooms inside the food hall." },
  { "id": "rr4", "cat": "restrooms", "hood": "downtown", "t": "Convention Center Public Restrooms", "a": "150 W San Carlos St, San Jose, CA", "lat": 37.3303, "lng": -121.889, "w": "", "ds": "Public restrooms at the Convention Center.\nMarriott hotel lobby restrooms.\nThe Westin hotel lobby restrooms." },
  { "id": "rr5", "cat": "restrooms", "hood": "downtown", "t": "MLK Library Restrooms", "a": "150 E San Fernando St, San Jose, CA", "lat": 37.3356, "lng": -121.8853, "ds": "Restrooms inside the Dr. Martin Luther King Jr. Library." },
  { "id": "tr1", "cat": "transit", "hood": "downtown", "t": "Diridon Station", "a": "65 Cahill St, San Jose, CA", "lat": 37.3306, "lng": -121.9023, "ds": "Caltrain, ACE, Amtrak and future BART/HSR hub." },
  { "id": "tr2", "cat": "transit", "hood": "downtown", "t": "Convention Center VTA Stop", "a": "1st St, San Jose, CA", "lat": 37.33, "lng": -121.8891, "ds": "VTA Light Rail stop near the Convention Center." },
  { "id": "tr3", "cat": "transit", "hood": "downtown", "t": "St James VTA Stop", "a": "N 1st St, San Jose, CA", "lat": 37.3418, "lng": -121.8905, "ds": "VTA Light Rail stop near St James Park." },
  { "id": "wh1", "cat": "restaurants", "hood": "downtown", "t": "Whispers Cafe and Creperie", "a": "150 S 2nd St, San Jose, CA 95113", "lat": 37.3339, "lng": -121.8868, "ds": "Breakfast, brunch, and crepes right next to Hammer Theatre.", "pk": "ParkSJ garages on 2nd and 3rd Street.", "tr": "VTA light rail Convention Center stop, 5 min walk.", "wb": "https://www.whisperscafe.com/" },
  { "id": "cb1", "cat": "restaurants", "hood": "downtown", "t": "Campus Burgers", "a": "108 Paseo de San Antonio, San Jose, CA 95113", "lat": 37.3334, "lng": -121.8861, "ds": "Smashburgers popular with SJSU students, right on the Paseo.", "pk": "ParkSJ garages on 2nd and 3rd Street.", "tr": "VTA light rail Convention Center stop, 5 min walk.", "wb": "https://campusburgers.com/" },
  { "id": "rp1", "cat": "shop", "hood": "downtown", "t": "Rosies & Posies", "a": "98 Paseo de San Antonio, San Jose, CA 95113", "lat": 37.3334, "lng": -121.8868, "ds": "Downtown florist and flower delivery, right between Hammer Theatre and Campus Burgers. Not listed on Google Maps yet - position matched to a photo you provided.", "pk": "ParkSJ garages on 2nd and 3rd Street.", "tr": "VTA light rail Convention Center stop, 5 min walk.", "wb": "https://www.rosiesandposies.net/" },
  { "id": "sub1", "cat": "restaurants", "hood": "downtown", "t": "Subway", "a": "S 2nd St, San Jose, CA 95113", "lat": 37.3338, "lng": -121.8876, "ds": "Sandwich shop on S 2nd St, just west of the Hammer Theatre plaza.", "pk": "ParkSJ garages on 2nd and 3rd Street.", "tr": "VTA light rail Convention Center stop, 5 min walk." },
  { "id": "tr4", "cat": "transit", "hood": "downtown", "t": "San Antonio Station", "a": "S 2nd St at Paseo de San Antonio, San Jose, CA", "lat": 37.3338, "lng": -121.8873, "ds": "VTA Light Rail stop on 2nd Street, also referred to as Paseo de San Antonio station - closest stop to Hammer Theatre and the farmers market." },
  { "id": "pk5", "cat": "parking", "hood": "downtown", "t": "MCM San Jose Parking", "a": "S 2nd St, San Jose, CA 95113", "lat": 37.3348, "lng": -121.8873, "ds": "Parking lot on 2nd St near Central Pl, north of the Hammer Theatre plaza." },
  { "id": "pk6", "cat": "parking", "hood": "downtown", "t": "Impark", "a": "S 2nd St, San Jose, CA 95113", "lat": 37.3342, "lng": -121.8866, "ds": "Parking lot between 2nd St and the Hammer Theatre plaza." },
  { "id": "rr6", "cat": "restrooms", "hood": "downtown", "t": "Paseo de San Antonio Restrooms (customers only)", "a": "Paseo de San Antonio, San Jose, CA 95113", "lat": 37.3337, "lng": -121.887, "ds": "No public restroom on this block - Whispers Cafe, Campus Burgers, and the nearby Subway all reserve restrooms for paying customers. Buy something small if you need to use one." },
  { "id": "sc1", "cat": "schools", "hood": "downtown", "t": "San Jose State University", "a": "1 Washington Sq, San Jose, CA 95192", "lat": 37.3352, "lng": -121.8811, "ds": "Public university anchoring the east edge of downtown; frequent public events and lectures." },
  { "id": "ch1", "cat": "churches", "hood": "downtown", "t": "Cathedral Basilica of St. Joseph", "a": "80 S Market St, San Jose, CA 95113", "lat": 37.3358, "lng": -121.8912, "ds": "Historic Catholic cathedral in the heart of downtown; hosts community and holiday services." },
  { "id": "ho1", "cat": "hospitals", "hood": "east", "t": "Regional Medical Center of San Jose", "a": "225 N Jackson Ave, San Jose, CA 95116", "lat": 37.3559, "lng": -121.8656, "ds": "Full-service hospital serving east San Jose." },
  { "id": "htl1", "cat": "hotels", "hood": "downtown", "t": "Signia by Hilton San Jose", "a": "170 S Market St, San Jose, CA 95113", "lat": 37.3325, "lng": -121.8894, "ds": "Downtown's largest hotel, next to Circle of Palms Plaza. Formerly the Fairmont San Jose - coordinates approximate, not geocode-verified.", "wb": "https://www.hilton.com/en/hotels/sjcshsh-signia-san-jose/" },
  { "id": "jt1", "cat": "foodhall", "hood": "japantown", "t": "Japantown Food Row", "a": "Jackson St, San Jose, CA", "lat": 37.3494, "lng": -121.8925, "ds": "Historic strip of Japanese restaurants and cafes." },
  { "id": "jt2", "cat": "shop", "hood": "japantown", "t": "Nichi Bei Bussan", "a": "140 Jackson St, San Jose, CA", "lat": 37.3496, "lng": -121.892, "ds": "Longtime Japanese import and gift shop." },
  { "id": "jt3", "cat": "parking", "hood": "japantown", "t": "Japantown Public Parking", "a": "Jackson St, San Jose, CA", "lat": 37.35, "lng": -121.8912, "ds": "Public lot serving Japantown businesses." },
  { "id": "sr1", "cat": "shop", "hood": "santana", "t": "Santana Row Shops", "a": "377 Santana Row, San Jose, CA", "lat": 37.3212, "lng": -121.948, "ds": "Upscale open-air shopping and dining district." },
  { "id": "sr2", "cat": "bars", "hood": "santana", "t": "Santana Row Dining", "a": "355 Santana Row, San Jose, CA", "lat": 37.3205, "lng": -121.9487, "ds": "Restaurants and rooftop bars along the row." },
  { "id": "sr3", "cat": "parking", "hood": "santana", "t": "Santana Row Garage", "a": "Santana Row, San Jose, CA", "lat": 37.3199, "lng": -121.9495, "ds": "Structured parking serving Santana Row." },
  { "id": "wg1", "cat": "shop", "hood": "willow", "t": "Lincoln Ave Shops", "a": "Lincoln Ave, San Jose, CA", "lat": 37.3066, "lng": -121.8897, "ds": "Boutique shopping strip along Lincoln Avenue." },
  { "id": "wg2", "cat": "foodhall", "hood": "willow", "t": "Willow Glen Cafes", "a": "Lincoln Ave, San Jose, CA", "lat": 37.307, "lng": -121.8905, "ds": "Cafes and casual dining on Lincoln Avenue." },
  { "id": "ar1", "cat": "market", "hood": "alum", "t": "Alum Rock Village Market", "a": "Alum Rock Ave, San Jose, CA", "lat": 37.3563, "lng": -121.8248, "ds": "Neighborhood market and produce stalls." },
  { "id": "ar2", "cat": "cityart", "hood": "alum", "t": "Alum Rock Park Trailhead Art", "a": "Penitencia Creek Rd, San Jose, CA", "lat": 37.3798, "lng": -121.7995, "ds": "Public art near the Alum Rock Park entrance." },
  { "id": "es1", "cat": "market", "hood": "east", "t": "Story Road Market", "a": "Story Rd, San Jose, CA", "lat": 37.3444, "lng": -121.8394, "ds": "Community market along Story Road." },
  { "id": "es2", "cat": "cityart", "hood": "east", "t": "East Side Community Mural", "a": "King Rd, San Jose, CA", "lat": 37.3465, "lng": -121.8362, "ds": "Community mural celebrating East San Jose." },
  { "id": "u1783435013531", "cat": "restaurants", "hood": "downtown", "t": "Eos & Nyx", "a": "201 S Second St #120, San Jose, CA 95113", "lat": 37.3332, "lng": -121.8872, "w": "tue-fri 5pm-9pm", "sh": 17, "eh": 21, "wb": "https://www.eosnyxsj.com/", "ds": "" },
  {
    "id": "u1783885081451", "cat": "holiday", "hood": "downtown",
    "t": "Mariachi Festival", "w": "Today 1pm - 8pm", "d": "2026-07-12", "sh": 13, "eh": 20, "ed": "2026-07-12",
    "a": "Plaza de Cesar Chavez, San Jose, CA 95113",
    "lat": 37.3323, "lng": -121.8897,
    "ds": "Mariachi Festival at Plaza de Cesar Chavez, 1-8pm today - live music with vendors along the street.",
    "wb": "https://tr.ee/6G_IJFtshX",
    "zone": [
      [37.332885505776645, -121.8904833386006],
      [37.333125469382146, -121.88995105608795],
      [37.3324186353823, -121.88950861424625],
      [37.332231567565415, -121.88996315002443]
    ]
  }
];
