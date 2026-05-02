-- 004_public_modifier_read_policies.sql
-- Public read policies for modifier groups and modifiers.

create policy modifier_groups_public_select
    on public.modifier_groups
    for select
    to anon, authenticated
    using (
        exists (
            select 1
            from public.restaurants r
            join public.menu_items mi
                on mi.restaurant_id = r.id
            where r.id = modifier_groups.restaurant_id
                and mi.id = modifier_groups.menu_item_id
                and mi.restaurant_id = modifier_groups.restaurant_id
                and r.is_active = true
                and mi.is_available = true
        )
    );

create policy modifiers_public_select
    on public.modifiers
    for select
    to anon, authenticated
    using (
        is_available = true
        and exists (
            select 1
            from public.restaurants r
            join public.modifier_groups mg
                on mg.restaurant_id = r.id
            join public.menu_items mi
                on mi.id = mg.menu_item_id
            where r.id = modifiers.restaurant_id
                and mg.id = modifiers.modifier_group_id
                and mg.restaurant_id = modifiers.restaurant_id
                and mi.restaurant_id = modifiers.restaurant_id
                and r.is_active = true
                and mi.is_available = true
        )
    );
