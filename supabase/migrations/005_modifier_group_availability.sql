-- 005_modifier_group_availability.sql
-- Adds is_available to modifier_groups so an entire group can be hidden
-- from customers without touching the availability of individual modifiers.

alter table public.modifier_groups
    add column if not exists is_available boolean not null default true;

-- Replace the public read policy from 004 so anon/authenticated users only
-- see groups that are themselves available. Modifier-level availability is
-- enforced separately in 004 and is intentionally NOT cascaded from here.
drop policy if exists modifier_groups_public_select on public.modifier_groups;

create policy modifier_groups_public_select
    on public.modifier_groups
    for select
    to anon, authenticated
    using (
        is_available = true
        and exists (
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
