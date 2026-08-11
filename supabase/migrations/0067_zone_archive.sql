-- P1-1 (post-stabilization integration pass): Event Zone Studio has no way
-- to retire a traced event zone without deleting it outright - `admin can
-- delete zone boundaries` (migration 0016) is the only removal path today,
-- which destroys the polygon/points data permanently (booths/vendor
-- assignments for the event are untouched, since they reference the event,
-- not the boundary row, but the traced shape itself and its history are
-- gone for good).
--
-- This adds a `status` column matching the exact convention already
-- established for `lov_entries.status` (migration 0062: 'archived' is this
-- codebase's own term for "admin manually took this down, don't delete the
-- row" - not a new vocabulary). RLS stays permissive (`using (true)`,
-- unchanged) on purpose - lov_entries-consuming pages already filter
-- status at the query level rather than baking it into RLS, and this
-- follows that same precedent instead of introducing a second pattern.
alter table public.zone_boundaries
  add column if not exists status text not null default 'active'
    check (status in ('active', 'archived'));

create index if not exists zone_boundaries_status_idx on public.zone_boundaries (status);

-- Note: zone_features/booths need no equivalent column. The public Map
-- (public/map/js/map.js loadEventZones()) only ever renders an event's
-- features/booths alongside its boundary polygon - once the boundary query
-- is filtered to status='active' (see the accompanying app-code change),
-- an archived event's features/booths stop rendering on the public map as
-- a side effect of the boundary itself disappearing, with no separate
-- column or query change needed for those two tables.
