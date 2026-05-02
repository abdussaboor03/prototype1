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

export default async function RestaurantsListPage() {
  await verifySuperAdmin()

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('restaurants')
    .select('id, name, slug, plan_type, is_active, created_at')
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as RestaurantRow[]

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
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No restaurants yet.{' '}
                  <Link
                    href="/super-admin/new-restaurant"
                    className="text-zinc-900 underline"
                  >
                    Create one
                  </Link>
                  .
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
                  <td className="px-4 py-3 text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString()}
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
