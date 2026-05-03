import Link from 'next/link'
import { verifyRestaurantAdmin } from '@/lib/auth/restaurant-dal'
import { signOut } from '../login/actions'

export default async function RestaurantAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifyRestaurantAdmin()

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link
              href="/restaurant-admin"
              className="text-sm font-semibold text-zinc-900"
            >
              {session.restaurantName}
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-600">
              <Link href="/restaurant-admin" className="hover:text-zinc-900">
                Dashboard
              </Link>
              <Link
                href="/restaurant-admin/orders"
                className="hover:text-zinc-900"
              >
                Orders
              </Link>
              <Link
                href="/restaurant-admin/menu"
                className="hover:text-zinc-900"
              >
                Menu
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-500">
              {session.email ?? 'Signed in'} · {session.role}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  )
}
