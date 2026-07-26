/* Vendor self-check-in pins - temporary and event-scoped. A vendor adds
   their own pin while an event is live to say "I'm here today"; each
   pin is tagged with the date it was added and gets pruned out
   automatically once that date has passed, so next week's occurrence of
   the same event starts empty again instead of showing last week's
   vendor lineup. No backend yet - same local-draft-then-export pattern
   as places.js/events.js, managed from vendor.html (not admin.html). */
var VENDOR_PINS = [];
