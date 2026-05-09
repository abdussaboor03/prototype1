import Link from 'next/link'
import { notFound } from 'next/navigation'
import { verifySuperAdmin } from '@/lib/auth/dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  QuickStatusForm,
  RestaurantEditForm,
  type EditableRestaurant,
} from './restaurant-edit-form'
import SuperAdminSettingsForm, {
  type SuperAdminSettings,
} from './super-admin-settings-form'
import SuperAdminBranchesForm, {
  type SuperAdminBranch,
} from './super-admin-branches-form'

type Restaurant = EditableRestaurant & {
  created_at: string
}

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>
}) {
  await verifySuperAdmin()
  const { restaurantId } = await params

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('restaurants')
    .select('id, name, slug, email, phone, plan_type, is_active, created_at')
    .eq('id', restaurantId)
    .maybeSingle<Restaurant>()

  if (error) {
    console.error('[super-admin/restaurant-detail] query failed', error)
  }
  if (!data) notFound()

  const { count: branchCountRaw, error: bErr } = await admin
    .from('branches')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', data.id)

  if (bErr) {
    console.error('[super-admin/restaurant-detail] branches count failed', bErr)
  }
  const branchCount = branchCountRaw ?? 0

  const { data: settings, error: sErr } = await admin
    .from('restaurant_settings')
    .select(
      'logo_url, banner_url, primary_color, secondary_color, whatsapp_number, instagram_url, facebook_url, minimum_order_amount, is_accepting_orders',
    )
    .eq('restaurant_id', data.id)
    .maybeSingle<SuperAdminSettings>()

  if (sErr) {
    console.error('[super-admin/restaurant-detail] settings query failed', sErr)
  }

  const { data: branchesData, error: brErr } = await admin
    .from('branches')
    .select(
      'id, name, opening_time, closing_time, is_accepting_orders, is_active',
    )
    .eq('restaurant_id', data.id)
    .order('created_at', { ascending: true })

  if (brErr) {
    console.error('[super-admin/restaurant-detail] branches list failed', brErr)
  }
  const branches = (branchesData ?? []) as SuperAdminBranch[]

  type CategoryRow = {
    id: string
    name: string
    slug: string
    sort_order: number | null
    is_active: boolean
  }
  type MenuItemRow = {
    id: string
    category_id: string | null
    name: string
    slug: string
    description: string | null
    price: number
    image_url: string | null
    is_available: boolean
    sort_order: number | null
  }
  type ModifierGroupRow = {
    id: string
    menu_item_id: string
    name: string
    is_required: boolean
    min_select: number
    max_select: number
    sort_order: number | null
    is_available: boolean
  }
  type ModifierRow = {
    id: string
    modifier_group_id: string
    name: string
    price_delta: number
    is_available: boolean
    sort_order: number | null
  }

  const [catRes, itemsRes, mgRes, mRes] = await Promise.all([
    admin
      .from('categories')
      .select('id, name, slug, sort_order, is_active')
      .eq('restaurant_id', data.id)
      .order('sort_order')
      .order('name'),
    admin
      .from('menu_items')
      .select(
        'id, category_id, name, slug, description, price, image_url, is_available, sort_order',
      )
      .eq('restaurant_id', data.id)
      .order('sort_order')
      .order('name'),
    admin
      .from('modifier_groups')
      .select(
        'id, menu_item_id, name, is_required, min_select, max_select, sort_order, is_available',
      )
      .eq('restaurant_id', data.id)
      .order('sort_order'),
    admin
      .from('modifiers')
      .select(
        'id, modifier_group_id, name, price_delta, is_available, sort_order',
      )
      .eq('restaurant_id', data.id)
      .order('sort_order'),
  ])

  if (catRes.error) {
    console.error('[super-admin/restaurant-detail] categories failed', catRes.error)
  }
  if (itemsRes.error) {
    console.error('[super-admin/restaurant-detail] menu_items failed', itemsRes.error)
  }
  if (mgRes.error) {
    console.error('[super-admin/restaurant-detail] modifier_groups failed', mgRes.error)
  }
  if (mRes.error) {
    console.error('[super-admin/restaurant-detail] modifiers failed', mRes.error)
  }

  const categories = (catRes.data ?? []) as CategoryRow[]
  const menuItems = (itemsRes.data ?? []) as MenuItemRow[]
  const modifierGroups = (mgRes.data ?? []) as ModifierGroupRow[]
  const modifiers = (mRes.data ?? []) as ModifierRow[]

  const itemsByCategory = new Map<string | null, MenuItemRow[]>()
  for (const it of menuItems) {
    const list = itemsByCategory.get(it.category_id) ?? []
    list.push(it)
    itemsByCategory.set(it.category_id, list)
  }
  const groupsByItem = new Map<string, ModifierGroupRow[]>()
  for (const g of modifierGroups) {
    const list = groupsByItem.get(g.menu_item_id) ?? []
    list.push(g)
    groupsByItem.set(g.menu_item_id, list)
  }
  const modifierCountByGroup = new Map<string, number>()
  for (const m of modifiers) {
    modifierCountByGroup.set(
      m.modifier_group_id,
      (modifierCountByGroup.get(m.modifier_group_id) ?? 0) + 1,
    )
  }
  const uncategorisedItems = itemsByCategory.get(null) ?? []

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/super-admin/restaurants"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Back to restaurants
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{data.name}</h1>
          <p className="text-sm text-zinc-500">
            Restaurant overview and settings.
          </p>
        </div>
        <QuickStatusForm restaurant={data} />
      </div>

      <dl className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Slug
          </dt>
          <dd className="mt-1 font-mono text-sm text-zinc-900">{data.slug}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Plan
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">{data.plan_type}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Email
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">
            {data.email ?? <span className="text-zinc-400">—</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Phone
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">
            {data.phone ?? <span className="text-zinc-400">—</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Status
          </dt>
          <dd className="mt-1">
            <span
              className={
                data.is_active
                  ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                  : 'rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600'
              }
            >
              {data.is_active ? 'active' : 'inactive'}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Branches
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">{branchCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Created
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">
            {new Date(data.created_at).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Public site
          </dt>
          <dd className="mt-1 text-sm">
            <Link
              href={`/${data.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-700 underline hover:text-zinc-900"
            >
              /{data.slug}
            </Link>
          </dd>
        </div>
      </dl>

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Edit details</h2>
          <p className="text-sm text-zinc-500">
            Update name, slug, contact info, plan, or status.
          </p>
        </div>
        <RestaurantEditForm restaurant={data} />
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            Restaurant settings
          </h2>
          <p className="text-sm text-zinc-500">
            Branding, contact links, ordering availability.
          </p>
        </div>
        {sErr ? (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to load settings: {sErr.message}
          </p>
        ) : settings ? (
          <SuperAdminSettingsForm
            restaurantId={data.id}
            restaurantSlug={data.slug}
            settings={settings}
          />
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No settings row exists for this restaurant. Create one in the
            database before editing here.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Branches</h2>
          <p className="text-sm text-zinc-500">
            Hours and ordering availability per branch.
          </p>
        </div>
        {brErr ? (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to load branches: {brErr.message}
          </p>
        ) : (
          <SuperAdminBranchesForm
            restaurantId={data.id}
            restaurantSlug={data.slug}
            branches={branches}
          />
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            Menu overview
          </h2>
          <p className="text-sm text-zinc-500">
            Read-only view of categories, items, and modifiers.
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Categories
            </dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900">
              {categories.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Menu items
            </dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900">
              {menuItems.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Modifier groups
            </dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900">
              {modifierGroups.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Modifiers
            </dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900">
              {modifiers.length}
            </dd>
          </div>
        </dl>

        {categories.length === 0 && menuItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No menu data yet for this restaurant.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {categories.map((c) => {
              const items = itemsByCategory.get(c.id) ?? []
              return (
                <li key={c.id} className="py-3 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900">
                      {c.name}
                    </span>
                    <span className="text-xs text-zinc-500">/{c.slug}</span>
                    {!c.is_active ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        inactive
                      </span>
                    ) : null}
                    <span className="text-xs text-zinc-500">
                      · {items.length} item{items.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {items.length > 0 ? (
                    <ul className="mt-2 space-y-1 pl-4">
                      {items.map((it) => {
                        const groups = groupsByItem.get(it.id) ?? []
                        const modCount = groups.reduce(
                          (sum, g) =>
                            sum + (modifierCountByGroup.get(g.id) ?? 0),
                          0,
                        )
                        return (
                          <li
                            key={it.id}
                            className="flex flex-wrap items-center gap-2 text-sm text-zinc-700"
                          >
                            <span>{it.name}</span>
                            <span className="text-xs text-zinc-500">
                              PKR {Number(it.price).toFixed(2)}
                            </span>
                            {!it.is_available ? (
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                                unavailable
                              </span>
                            ) : null}
                            <span className="text-xs text-zinc-500">
                              · {groups.length} group
                              {groups.length === 1 ? '' : 's'} / {modCount}{' '}
                              modifier{modCount === 1 ? '' : 's'}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </li>
              )
            })}
            {uncategorisedItems.length > 0 ? (
              <li className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900">
                    Uncategorised
                  </span>
                  <span className="text-xs text-zinc-500">
                    · {uncategorisedItems.length} item
                    {uncategorisedItems.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 pl-4">
                  {uncategorisedItems.map((it) => {
                    const groups = groupsByItem.get(it.id) ?? []
                    const modCount = groups.reduce(
                      (sum, g) => sum + (modifierCountByGroup.get(g.id) ?? 0),
                      0,
                    )
                    return (
                      <li
                        key={it.id}
                        className="flex flex-wrap items-center gap-2 text-sm text-zinc-700"
                      >
                        <span>{it.name}</span>
                        <span className="text-xs text-zinc-500">
                          PKR {Number(it.price).toFixed(2)}
                        </span>
                        {!it.is_available ? (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                            unavailable
                          </span>
                        ) : null}
                        <span className="text-xs text-zinc-500">
                          · {groups.length} group
                          {groups.length === 1 ? '' : 's'} / {modCount} modifier
                          {modCount === 1 ? '' : 's'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ) : null}
          </ul>
        )}

        <p className="text-xs text-zinc-500">
          Editing comes in SA-4B/SA-4C/SA-4D.
        </p>
      </section>
    </div>
  )
}
