/* V2's Supabase project — separate from public/shared/supabase-config.js,
   which is V1's own, already-live project and is never touched. This one
   is read-only here: the Map and Board fetch V2's lov_entries (calendar
   events) so an event seeded once shows up everywhere instead of only on
   /calendar. Public anon key, safe to ship — Row Level Security is what
   actually protects the data, same as V1's own config. */
var V2_SUPABASE_URL = "https://shfmaywwlfkfyqwbejuy.supabase.co";
var V2_SUPABASE_ANON_KEY = "sb_publishable_AZoyWfB63MYlnV7mn4vR0Q_tRd2ePFd";
