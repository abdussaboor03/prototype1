import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
})

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

  const itemsByCategory = new Map<string, MenuItem[]>()
  for (const item of menuItems) {
    if (!item.category_id) continue
    const list = itemsByCategory.get(item.category_id) ?? []
    list.push(item)
    itemsByCategory.set(item.category_id, list)
  }

  const primary = settings?.primary_color ?? '#111111'
  const secondary = settings?.secondary_color ?? '#ffffff'
  const accepting = settings?.is_accepting_orders ?? true

  const cssVars = {
    '--brand': primary,
    '--brand-contrast': secondary,
  } as React.CSSProperties

  const hasMenu = categories.length > 0 && menuItems.length > 0

  return (
    <div style={cssVars} className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Banner */}
      <div className="relative h-40 w-full bg-zinc-200 sm:h-56">
        {settings?.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.banner_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundColor: 'var(--brand)' }}
          />
        )}
      </div>

      <div className="mx-auto -mt-10 w-full max-w-3xl px-4 pb-16 sm:-mt-12 sm:px-6">
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

        {/* Menu */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Menu</h2>

          {!hasMenu ? (
            <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              The menu is not available yet. Please check back soon.
            </div>
          ) : (
            <div className="mt-4 space-y-8">
              {categories.map((cat) => {
                const items = itemsByCategory.get(cat.id) ?? []
                if (items.length === 0) return null
                return (
                  <div key={cat.id}>
                    <h3
                      className="text-base font-semibold"
                      style={{ color: 'var(--brand)' }}
                    >
                      {cat.name}
                    </h3>
                    {cat.description ? (
                      <p className="mt-0.5 text-sm text-zinc-500">
                        {cat.description}
                      </p>
                    ) : null}
                    <ul className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 p-4 sm:gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="truncate font-medium">
                                {item.name}
                              </p>
                              <p className="shrink-0 text-sm font-semibold">
                                {pkr.format(Number(item.price))}
                              </p>
                            </div>
                            {item.description ? (
                              <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                          {item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image_url}
                              alt=""
                              className="h-16 w-16 shrink-0 rounded-md object-cover sm:h-20 sm:w-20"
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <footer className="mt-12 text-center text-xs text-zinc-400">
          Powered by your platform
        </footer>
      </div>
    </div>
  )
}
