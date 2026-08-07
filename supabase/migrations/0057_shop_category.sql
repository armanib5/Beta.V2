-- "Shops" has been a real, visible board section (public/board/js/app.js's
-- C.shop bucket) since early on, but there was never an actual "Shop"
-- row in public.categories to select - a vendor could only ever land
-- there by accident, tagged with some other category that happens not
-- to have an explicit BOARD_CAT_SLUGS mapping (e.g. Candy & Sweets).
-- This adds the real, selectable category so "Shop" is an intentional
-- choice in every category picker (vendor dashboard, admin vendor edit,
-- the public flyer form), not a fallback nobody can actually pick.

insert into public.categories (name, slug, icon, sort_order)
select 'Shop', 'shop', '🛍️', 12
where not exists (select 1 from public.categories where slug = 'shop');
