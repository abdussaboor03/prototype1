import { verifySuperAdmin } from '@/lib/auth/dal'

export default async function SuperAdminDashboardPage() {
  const session = await verifySuperAdmin()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
      <p className="text-sm text-zinc-600">
        Welcome, {session.fullName ?? session.email ?? 'super admin'}. The
        restaurants list and onboarding flow land in the next step.
      </p>
    </div>
  )
}
