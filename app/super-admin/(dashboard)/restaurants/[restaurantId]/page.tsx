import Link from 'next/link'
import { notFound } from 'next/navigation'
import { verifySuperAdmin } from '@/lib/auth/dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type Restaurant = {
  id: string
  name: string
  slug: string
  plan_type: string
  is_active: boolean
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
    .select('id, name, slug, plan_type, is_active')
    .eq('id', restaurantId)
    .maybeSingle<Restaurant>()

  if (error) {
    console.error('[super-admin/restaurant-detail] query failed', error)
  }
  if (!data) notFound()

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

      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{data.name}</h1>
        <p className="text-sm text-zinc-500">
          More management tools coming next.
        </p>
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
    </div>
  )
}
