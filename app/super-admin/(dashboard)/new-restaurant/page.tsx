import { verifySuperAdmin } from '@/lib/auth/dal'
import { NewRestaurantForm } from './form'

export default async function NewRestaurantPage() {
  await verifySuperAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">New restaurant</h1>
        <p className="text-sm text-zinc-500">
          Creates the restaurant, its settings, and a first branch.
        </p>
      </div>
      <NewRestaurantForm />
    </div>
  )
}
