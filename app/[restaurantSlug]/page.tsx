import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import RestaurantMenuClient from './restaurant-menu-client'

type Restaurant = {
  id: string
  name: string
  slug: string
  phone: string | null
  is_active: boolean
}

type Settings = {
  logo_url: string | null
  banner_url: string | null
  primary_color: string | null
  secondary_color: string | null
  whatsapp_number: string | null
  instagram_url: string | null
  facebook_url: string | null
  is_accepting_orders: boolean
}

type Branch = {
  id: string
  name: string
  address: string | null
  phone: string | null
  opening_time: string | null
  closing_time: string | null
  is_accepting_orders: boolean
}

type Category = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  sort_order: number
}

type MenuItem = {
  id: string
  category_id: string | null
  name: string
  description: string | null
  image_url: string | null
  price: number
  is_available: boolean
  sort_order: number
}

type ModifierGroup = {
  id: string
  menu_item_id: string
  name: string
  is_required: boolean
  min_select: number
  max_select: number
  sort_order: number
}

type Modifier = {
  id: string
  modifier_group_id: string
  name: string
  price_delta: number
  sort_order: number
}

function formatTime(t: string | null) {
  if (!t) return null
  // t is "HH:MM:SS" — strip seconds for display.
  return t.length >= 5 ? t.slice(0, 5) : t
}

export default async function PublicRestaurantPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>
}) {
  const { restaurantSlug } = await params
  const supabase = await createSupabaseServerClient()

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name, slug, phone, is_active')
    .eq('slug', restaurantSlug)
    .eq('is_active', true)
    .maybeSingle<Restaurant>()

  if (restaurantError) {
    console.error('[public-menu] restaurant query failed', restaurantError)
  }

  if (!restaurant) notFound()

  const [settingsRes, branchesRes, categoriesRes, menuItemsRes] =
    await Promise.all([
      supabase
        .from('restaurant_settings')
        .select(
          'logo_url, banner_url, primary_color, secondary_color, whatsapp_number, instagram_url, facebook_url, is_accepting_orders',
        )
        .eq('restaurant_id', restaurant.id)
        .maybeSingle<Settings>(),
      supabase
        .from('branches')
        .select(
          'id, name, address, phone, opening_time, closing_time, is_accepting_orders',
        )
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('categories')
        .select('id, name, description, image_url, sort_order')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('sort_order')
        .order('name'),
      supabase
        .from('menu_items')
        .select(
          'id, category_id, name, description, image_url, price, is_available, sort_order',
        )
        .eq('restaurant_id', restaurant.id)
        .eq('is_available', true)
        .order('sort_order')
        .order('name'),
    ])

  if (settingsRes.error) {
    console.error('[public-menu] settings query failed', settingsRes.error)
  }
  if (branchesRes.error) {
    console.error('[public-menu] branches query failed', branchesRes.error)
  }
  if (categoriesRes.error) {
    console.error('[public-menu] categories query failed', categoriesRes.error)
  }
  if (menuItemsRes.error) {
    console.error('[public-menu] menu_items query failed', menuItemsRes.error)
  }

  const settings = settingsRes.data
  const branches = (branchesRes.data ?? []) as Branch[]
  const categories = (categoriesRes.data ?? []) as Category[]
  const menuItems = (menuItemsRes.data ?? []) as MenuItem[]

  let modifierGroups: ModifierGroup[] = []
  let modifiers: Modifier[] = []

  if (menuItems.length > 0) {
    const mgRes = await supabase
      .from('modifier_groups')
      .select(
        'id, menu_item_id, name, is_required, min_select, max_select, sort_order',
      )
      .in(
        'menu_item_id',
        menuItems.map((m) => m.id),
      )
      .eq('is_available', true)
      .order('sort_order')

    if (mgRes.error) {
      console.error('[public-menu] modifier_groups query failed', mgRes.error)
    }

    modifierGroups = (mgRes.data ?? []) as ModifierGroup[]

    if (modifierGroups.length > 0) {
      const mRes = await supabase
        .from('modifiers')
        .select('id, modifier_group_id, name, price_delta, sort_order')
        .in(
          'modifier_group_id',
          modifierGroups.map((g) => g.id),
        )
        .order('sort_order')

      if (mRes.error) {
        console.error('[public-menu] modifiers query failed', mRes.error)
      }

      modifiers = (mRes.data ?? []) as Modifier[]
    }
  }

  const primary = settings?.primary_color ?? '#111111'
  const secondary = settings?.secondary_color ?? '#ffffff'
  const accepting = settings?.is_accepting_orders ?? true

  const cssVars = {
    '--brand': primary,
    '--brand-contrast': secondary,
  } as React.CSSProperties

  return (
    <div style={cssVars} className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Banner */}
      {settings?.banner_url ? (
        <div className="relative h-40 w-full bg-zinc-200 sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={settings.banner_url}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="h-24 w-full bg-gradient-to-b from-zinc-100 to-zinc-50 sm:h-32" />
      )}

      <div className="mx-auto -mt-10 w-full max-w-3xl px-4 pb-32 sm:-mt-12 sm:px-6">
        {/* Header card */}
        <header className="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 sm:h-20 sm:w-20">
            {settings?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo_url}
                alt={`${restaurant.name} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-lg font-semibold"
                style={{
                  backgroundColor: 'var(--brand)',
                  color: 'var(--brand-contrast)',
                }}
              >
                {restaurant.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">
              {restaurant.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <span
                className={
                  accepting
                    ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'
                    : 'rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600'
                }
              >
                {accepting ? 'Accepting orders' : 'Closed'}
              </span>
              {restaurant.phone ? <span>· {restaurant.phone}</span> : null}
            </div>
            {(settings?.whatsapp_number ||
              settings?.instagram_url ||
              settings?.facebook_url) && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                {settings.whatsapp_number ? (
                  <span>WhatsApp: {settings.whatsapp_number}</span>
                ) : null}
                {settings.instagram_url ? (
                  <a
                    href={settings.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-zinc-900"
                  >
                    Instagram
                  </a>
                ) : null}
                {settings.facebook_url ? (
                  <a
                    href={settings.facebook_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-zinc-900"
                  >
                    Facebook
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </header>

        {/* Branches */}
        {branches.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Branches
            </h2>
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {branches.map((b) => (
                <li
                  key={b.id}
                  className="rounded-lg border border-zinc-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{b.name}</p>
                    <span
                      className={
                        b.is_accepting_orders
                          ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                          : 'rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600'
                      }
                    >
                      {b.is_accepting_orders ? 'open' : 'closed'}
                    </span>
                  </div>
                  {b.address ? (
                    <p className="mt-1 text-sm text-zinc-600">{b.address}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                    {b.phone ? <span>{b.phone}</span> : null}
                    {b.opening_time && b.closing_time ? (
                      <span>
                        {formatTime(b.opening_time)}–
                        {formatTime(b.closing_time)}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <RestaurantMenuClient
          restaurantSlug={restaurant.slug}
          primaryColor={primary}
          categories={categories}
          menuItems={menuItems}
          modifierGroups={modifierGroups}
          modifiers={modifiers}
        />

        <footer className="mt-12 text-center text-xs text-zinc-400">
          Powered by your platform
        </footer>
      </div>
    </div>
  )
}
