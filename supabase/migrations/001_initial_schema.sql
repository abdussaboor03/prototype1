-- =====================================================================
-- 001_initial_schema.sql
-- Multi-tenant restaurant ordering platform — initial schema (MVP)
-- Safe to run on a fresh Supabase project.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- Shared trigger: keep updated_at in sync on row updates
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- ---------------------------------------------------------------------
-- platform_users: super admins / platform owners (separate from tenants)
-- ---------------------------------------------------------------------
create table public.platform_users (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null unique references auth.users(id) on delete cascade,
    full_name       text,
    email           text,
    user_role       text not null default 'super_admin'
        check (user_role in ('super_admin', 'platform_owner', 'support')),
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- restaurants: top-level tenant (one row per restaurant brand/account)
-- ---------------------------------------------------------------------
create table public.restaurants (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    slug            text not null unique,
    email           text,
    phone           text,
    plan_type       text not null default 'free'
        check (plan_type in ('free', 'starter', 'pro', 'enterprise')),
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- branches: physical locations belonging to a restaurant
-- ---------------------------------------------------------------------
create table public.branches (
    id                      uuid primary key default gen_random_uuid(),
    restaurant_id           uuid not null references public.restaurants(id) on delete cascade,
    name                    text not null,
    slug                    text not null,
    address                 text,
    phone                   text,
    opening_time            time,
    closing_time            time,
    is_accepting_orders     boolean not null default true,
    is_active               boolean not null default true,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now(),
    unique (restaurant_id, slug)
);

-- ---------------------------------------------------------------------
-- restaurant_users: links Supabase auth users to a restaurant + role
-- ---------------------------------------------------------------------
create table public.restaurant_users (
    id              uuid primary key default gen_random_uuid(),
    restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
    user_id         uuid not null references auth.users(id) on delete cascade,
    branch_id       uuid references public.branches(id) on delete set null,
    user_role       text not null
        check (user_role in ('owner', 'admin', 'manager', 'staff', 'cashier')),
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (restaurant_id, user_id)
);

-- ---------------------------------------------------------------------
-- restaurant_settings: per-tenant config (branding, contact, ordering)
-- ---------------------------------------------------------------------
create table public.restaurant_settings (
    id                      uuid primary key default gen_random_uuid(),
    restaurant_id           uuid not null unique references public.restaurants(id) on delete cascade,
    currency                text not null default 'PKR',
    timezone                text not null default 'Asia/Karachi',
    tax_rate                numeric(5,2) not null default 0,
    service_charge_rate     numeric(5,2) not null default 0,
    minimum_order_amount    numeric(10,2) not null default 0,
    is_accepting_orders     boolean not null default true,
    logo_url                text,
    banner_url              text,
    primary_color           text default '#000000',
    secondary_color         text default '#ffffff',
    whatsapp_number         text,
    instagram_url           text,
    facebook_url            text,
    settings                jsonb not null default '{}'::jsonb,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- categories: menu categories per restaurant
-- ---------------------------------------------------------------------
create table public.categories (
    id              uuid primary key default gen_random_uuid(),
    restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
    name            text not null,
    slug            text not null,
    description     text,
    image_url       text,
    sort_order      integer not null default 0,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (restaurant_id, slug)
);

-- ---------------------------------------------------------------------
-- menu_items: individual sellable items
-- ---------------------------------------------------------------------
create table public.menu_items (
    id              uuid primary key default gen_random_uuid(),
    restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
    category_id     uuid references public.categories(id) on delete set null,
    name            text not null,
    slug            text not null,
    description     text,
    image_url       text,
    price           numeric(10,2) not null check (price >= 0),
    is_available    boolean not null default true,
    sort_order      integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (restaurant_id, slug)
);

-- ---------------------------------------------------------------------
-- modifier_groups: groups of modifiers attached to menu items
-- ---------------------------------------------------------------------
create table public.modifier_groups (
    id              uuid primary key default gen_random_uuid(),
    restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
    menu_item_id    uuid not null references public.menu_items(id) on delete cascade,
    name            text not null,
    is_required     boolean not null default false,
    min_select      integer not null default 0 check (min_select >= 0),
    max_select      integer not null default 1 check (max_select >= 0),
    sort_order      integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    check (max_select >= min_select)
);

-- ---------------------------------------------------------------------
-- modifiers: individual options inside a modifier group
-- ---------------------------------------------------------------------
create table public.modifiers (
    id                  uuid primary key default gen_random_uuid(),
    restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
    modifier_group_id   uuid not null references public.modifier_groups(id) on delete cascade,
    name                text not null,
    price_delta         numeric(10,2) not null default 0,
    is_available        boolean not null default true,
    sort_order          integer not null default 0,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- customers: end-user customers per restaurant
-- ---------------------------------------------------------------------
create table public.customers (
    id              uuid primary key default gen_random_uuid(),
    restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
    name            text,
    phone           text,
    email           text,
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (restaurant_id, phone)
);

-- ---------------------------------------------------------------------
-- delivery_zones: delivery areas with fees and minimums
-- ---------------------------------------------------------------------
create table public.delivery_zones (
    id              uuid primary key default gen_random_uuid(),
    restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
    branch_id       uuid references public.branches(id) on delete cascade,
    name            text not null,
    delivery_fee    numeric(10,2) not null default 0,
    min_order       numeric(10,2) not null default 0,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- orders: customer orders (header)
-- ---------------------------------------------------------------------
create table public.orders (
    id                  uuid primary key default gen_random_uuid(),
    restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
    branch_id           uuid references public.branches(id) on delete set null,
    customer_id         uuid references public.customers(id) on delete set null,
    delivery_zone_id    uuid references public.delivery_zones(id) on delete set null,
    order_number        text not null,
    order_type          text not null
        check (order_type in ('dine_in', 'takeaway', 'delivery', 'pickup')),
    order_status        text not null default 'pending'
        check (order_status in ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled')),
    order_source        text not null default 'website'
        check (order_source in ('website', 'pos', 'whatsapp', 'manual')),
    subtotal            numeric(10,2) not null default 0,
    tax_amount          numeric(10,2) not null default 0,
    delivery_fee        numeric(10,2) not null default 0,
    discount_amount     numeric(10,2) not null default 0,
    total_amount        numeric(10,2) not null default 0,
    customer_name       text,
    customer_phone      text,
    delivery_address    text,
    notes               text,
    placed_at           timestamptz not null default now(),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (restaurant_id, order_number)
);

-- ---------------------------------------------------------------------
-- order_items: line items inside an order, with snapshots for history
-- ---------------------------------------------------------------------
create table public.order_items (
    id                      uuid primary key default gen_random_uuid(),
    restaurant_id           uuid not null references public.restaurants(id) on delete cascade,
    order_id                uuid not null references public.orders(id) on delete cascade,
    menu_item_id            uuid references public.menu_items(id) on delete set null,
    item_name_snapshot      text not null,
    unit_price_snapshot     numeric(10,2) not null check (unit_price_snapshot >= 0),
    selected_modifiers      jsonb not null default '[]'::jsonb,
    quantity                integer not null check (quantity > 0),
    subtotal                numeric(10,2) not null check (subtotal >= 0),
    notes                   text,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- payments: payment records linked to an order
-- ---------------------------------------------------------------------
create table public.payments (
    id                  uuid primary key default gen_random_uuid(),
    restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
    order_id            uuid not null references public.orders(id) on delete cascade,
    amount              numeric(10,2) not null check (amount >= 0),
    payment_method      text not null
        check (payment_method in ('cash', 'card', 'easypaisa', 'jazzcash', 'bank_transfer', 'manual')),
    payment_status      text not null default 'pending'
        check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
    transaction_ref     text,
    paid_at             timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- order_status_history: audit trail of order status transitions
-- ---------------------------------------------------------------------
create table public.order_status_history (
    id              uuid primary key default gen_random_uuid(),
    restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
    order_id        uuid not null references public.orders(id) on delete cascade,
    from_status     text,
    to_status       text not null,
    changed_by      uuid references auth.users(id) on delete set null,
    note            text,
    created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- audit_logs: generic per-tenant audit trail of significant actions
-- ---------------------------------------------------------------------
create table public.audit_logs (
    id              uuid primary key default gen_random_uuid(),
    restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
    user_id         uuid references auth.users(id) on delete set null,
    entity_type     text not null,
    entity_id       uuid,
    action          text not null,
    metadata        jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now()
);

-- =====================================================================
-- Indexes
-- =====================================================================
create index idx_platform_users_user_id           on public.platform_users(user_id);
create index idx_platform_users_role              on public.platform_users(user_role);

create index idx_branches_restaurant_id           on public.branches(restaurant_id);
create index idx_branches_slug                    on public.branches(slug);

create index idx_restaurant_users_restaurant_id   on public.restaurant_users(restaurant_id);
create index idx_restaurant_users_user_id         on public.restaurant_users(user_id);

create index idx_categories_restaurant_id         on public.categories(restaurant_id);
create index idx_categories_slug                  on public.categories(slug);

create index idx_menu_items_restaurant_id         on public.menu_items(restaurant_id);
create index idx_menu_items_category_id           on public.menu_items(category_id);
create index idx_menu_items_slug                  on public.menu_items(slug);

create index idx_modifier_groups_restaurant_id    on public.modifier_groups(restaurant_id);
create index idx_modifier_groups_menu_item_id     on public.modifier_groups(menu_item_id);

create index idx_modifiers_restaurant_id          on public.modifiers(restaurant_id);
create index idx_modifiers_group_id               on public.modifiers(modifier_group_id);

create index idx_customers_restaurant_id          on public.customers(restaurant_id);
create index idx_customers_phone                  on public.customers(phone);

create index idx_delivery_zones_restaurant_id     on public.delivery_zones(restaurant_id);

create index idx_orders_restaurant_id             on public.orders(restaurant_id);
create index idx_orders_branch_id                 on public.orders(branch_id);
create index idx_orders_customer_id               on public.orders(customer_id);
create index idx_orders_status                    on public.orders(order_status);
create index idx_orders_source                    on public.orders(order_source);
create index idx_orders_created_at                on public.orders(created_at desc);

create index idx_order_items_restaurant_id        on public.order_items(restaurant_id);
create index idx_order_items_order_id             on public.order_items(order_id);

create index idx_payments_restaurant_id           on public.payments(restaurant_id);
create index idx_payments_order_id                on public.payments(order_id);
create index idx_payments_status                  on public.payments(payment_status);

create index idx_order_status_history_order_id    on public.order_status_history(order_id);
create index idx_order_status_history_created_at  on public.order_status_history(created_at desc);

create index idx_audit_logs_restaurant_id         on public.audit_logs(restaurant_id);
create index idx_audit_logs_entity                on public.audit_logs(entity_type, entity_id);
create index idx_audit_logs_created_at            on public.audit_logs(created_at desc);

-- =====================================================================
-- updated_at triggers (only for tables with an updated_at column)
-- =====================================================================
create trigger trg_platform_users_updated_at
    before update on public.platform_users
    for each row execute function public.set_updated_at();

create trigger trg_restaurants_updated_at
    before update on public.restaurants
    for each row execute function public.set_updated_at();

create trigger trg_branches_updated_at
    before update on public.branches
    for each row execute function public.set_updated_at();

create trigger trg_restaurant_users_updated_at
    before update on public.restaurant_users
    for each row execute function public.set_updated_at();

create trigger trg_restaurant_settings_updated_at
    before update on public.restaurant_settings
    for each row execute function public.set_updated_at();

create trigger trg_categories_updated_at
    before update on public.categories
    for each row execute function public.set_updated_at();

create trigger trg_menu_items_updated_at
    before update on public.menu_items
    for each row execute function public.set_updated_at();

create trigger trg_modifier_groups_updated_at
    before update on public.modifier_groups
    for each row execute function public.set_updated_at();

create trigger trg_modifiers_updated_at
    before update on public.modifiers
    for each row execute function public.set_updated_at();

create trigger trg_customers_updated_at
    before update on public.customers
    for each row execute function public.set_updated_at();

create trigger trg_delivery_zones_updated_at
    before update on public.delivery_zones
    for each row execute function public.set_updated_at();

create trigger trg_orders_updated_at
    before update on public.orders
    for each row execute function public.set_updated_at();

create trigger trg_order_items_updated_at
    before update on public.order_items
    for each row execute function public.set_updated_at();

create trigger trg_payments_updated_at
    before update on public.payments
    for each row execute function public.set_updated_at();

-- =====================================================================
-- Row Level Security — enable on every table.
-- Policies will be added in a later migration.
-- =====================================================================
alter table public.platform_users         enable row level security;
alter table public.restaurants            enable row level security;
alter table public.branches               enable row level security;
alter table public.restaurant_users       enable row level security;
alter table public.restaurant_settings    enable row level security;
alter table public.categories             enable row level security;
alter table public.menu_items             enable row level security;
alter table public.modifier_groups        enable row level security;
alter table public.modifiers              enable row level security;
alter table public.customers              enable row level security;
alter table public.delivery_zones         enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.payments               enable row level security;
alter table public.order_status_history   enable row level security;
alter table public.audit_logs             enable row level security;
