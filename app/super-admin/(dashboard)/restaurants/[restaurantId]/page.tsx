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
    </div>
  )
}
