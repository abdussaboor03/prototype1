import Link from 'next/link'
import { verifySuperAdmin } from '@/lib/auth/dal'
import { signOut } from '../login/actions'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifySuperAdmin()

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link
              href="/super-admin"
              className="text-sm font-semibold text-zinc-900"
            >
              Super admin
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-600">
              <Link href="/super-admin" className="hover:text-zinc-900">
                Dashboard
              </Link>
              <Link
                href="/super-admin/restaurants"
                className="hover:text-zinc-900"
              >
                Restaurants
              </Link>
              <Link
                href="/super-admin/new-restaurant"
                className="hover:text-zinc-900"
              >
                New restaurant
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-500">
              {session.fullName ?? session.email ?? 'Signed in'}
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
