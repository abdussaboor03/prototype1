import { verifyRestaurantAdmin } from '@/lib/auth/restaurant-dal'

export default async function RestaurantAdminDashboardPage() {
  const session = await verifyRestaurantAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Restaurant admin dashboard coming next.
        </p>
      </div>

      <dl className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Restaurant
          </dt>
          <dd className="mt-1 text-sm font-medium text-zinc-900">
            {session.restaurantName}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Role
          </dt>
          <dd className="mt-1 text-sm capitalize text-zinc-900">
            {session.role}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Branch
          </dt>
          <dd className="mt-1 text-sm text-zinc-900">
            {session.branchName ?? '—'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
