-- 003_public_read_policies.sql
-- Public (anonymous) read policies for the customer-facing menu page.
-- Exposes only active restaurants and available menu items.

-- ---------------------------------------------------------------------
-- restaurants: anyone can read active restaurants
-- ---------------------------------------------------------------------
create policy restaurants_public_select
    on public.restaurants
    for select
    to anon, authenticated
    using (is_active = true);

-- ---------------------------------------------------------------------
-- restaurant_settings: readable only when the parent restaurant is active
-- ---------------------------------------------------------------------
create policy restaurant_settings_public_select
    on public.restaurant_settings
    for select
    to anon, authenticated
    using (
        exists (
            select 1
            from public.restaurants r
            where r.id = restaurant_settings.restaurant_id
                and r.is_active = true
        )
    );

-- ---------------------------------------------------------------------
-- branches: active branches of active restaurants
-- ---------------------------------------------------------------------
create policy branches_public_select
    on public.branches
    for select
    to anon, authenticated
    using (
        is_active = true
        and exists (
            select 1
            from public.restaurants r
            where r.id = branches.restaurant_id
                and r.is_active = true
        )
    );

-- ---------------------------------------------------------------------
-- categories: active categories of active restaurants
-- ---------------------------------------------------------------------
create policy categories_public_select
    on public.categories
    for select
    to anon, authenticated
    using (
        is_active = true
        and exists (
            select 1
            from public.restaurants r
            where r.id = categories.restaurant_id
                and r.is_active = true
        )
    );

-- ---------------------------------------------------------------------
-- menu_items: available items belonging to active restaurants
-- ---------------------------------------------------------------------
create policy menu_items_public_select
    on public.menu_items
    for select
    to anon, authenticated
    using (
        is_available = true
        and exists (
            select 1
            from public.restaurants r
            where r.id = menu_items.restaurant_id
                and r.is_active = true
        )
    );
