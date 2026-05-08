import Link from 'next/link'
import { verifySuperAdmin } from '@/lib/auth/dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type RestaurantRow = {
  id: string
  name: string
  slug: string
  plan_type: string
  is_active: boolean
  created_at: string
}

const STATUS_OPTIONS = ['all', 'active', 'inactive'] as const
const PLAN_OPTIONS = [
  'all',
  'free',
  'starter',
  'pro',
  'enterprise',
] as const

type StatusFilter = (typeof STATUS_OPTIONS)[number]
type PlanFilter = (typeof PLAN_OPTIONS)[number]

export default async function RestaurantsListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; plan?: string }>
}) {
  await verifySuperAdmin()

  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const status: StatusFilter = (STATUS_OPTIONS as readonly string[]).includes(
    sp.status ?? '',
  )
    ? (sp.status as StatusFilter)
    : 'all'
  const plan: PlanFilter = (PLAN_OPTIONS as readonly string[]).includes(
    sp.plan ?? '',
  )
    ? (sp.plan as PlanFilter)
    : 'all'

  const admin = createSupabaseAdminClient()
  let query = admin
    .from('restaurants')
    .select('id, name, slug, plan_type, is_active, created_at')
    .order('created_at', { ascending: false })

  if (q) {
    const escaped = q.replace(/[%,]/g, '')
    query = query.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`)
  }
  if (status === 'active') query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)
  if (plan !== 'all') query = query.eq('plan_type', plan)

  const { data, error } = await query

  if (error) {
    console.error('[super-admin/restaurants] query failed', error)
  }

  const rows = (data ?? []) as RestaurantRow[]

  // Branch counts: one query for all listed restaurants, count in JS.
  const branchCount = new Map<string, number>()
  if (rows.length > 0) {
    const { data: branchRows, error: bErr } = await admin
      .from('branches')
      .select('restaurant_id')
      .in(
        'restaurant_id',
        rows.map((r) => r.id),
      )
    if (bErr) {
      console.error('[super-admin/restaurants] branches query failed', bErr)
    }
    for (const b of (branchRows ?? []) as { restaurant_id: string }[]) {
      branchCount.set(
        b.restaurant_id,
        (branchCount.get(b.restaurant_id) ?? 0) + 1,
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Restaurants</h1>
          <p className="text-sm text-zinc-500">
            {rows.length} restaurant{rows.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          href="/super-admin/new-restaurant"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          New restaurant
        </Link>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-3"
      >
        <div className="flex-1 min-w-[12rem]">
          <label className="block text-xs font-medium text-zinc-700">
            Search
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Name or slug"
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="mt-1 rounded-md border border-zinc-200 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            Plan
          </label>
          <select
            name="plan"
            defaultValue={plan}
            className="mt-1 rounded-md border border-zinc-200 px-3 py-2 text-sm"
          >
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Apply
          </button>
          <Link
            href="/super-admin/restaurants"
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Clear
          </Link>
        </div>
      </form>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load restaurants: {error.message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Branches</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  No restaurants match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {r.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{r.slug}</td>
                  <td className="px-4 py-3 text-zinc-600">{r.plan_type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.is_active
                          ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                          : 'rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600'
                      }
                    >
                      {r.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {branchCount.get(r.id) ?? 0}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${r.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-700 underline hover:text-zinc-900"
                    >
                      Visit
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/super-admin/restaurants/${r.id}`}
                      className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
