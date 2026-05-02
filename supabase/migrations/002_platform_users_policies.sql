-- 002_platform_users_policies.sql
-- Self-read RLS policy + is_super_admin() helper.

-- Authenticated users can read only their own platform_users row.
create policy platform_users_self_select
    on public.platform_users
    for select
    to authenticated
    using (user_id = auth.uid());

-- True when the caller is an active super_admin or platform_owner.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.platform_users
        where user_id = auth.uid()
            and is_active = true
            and user_role in ('super_admin', 'platform_owner')
    );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;
