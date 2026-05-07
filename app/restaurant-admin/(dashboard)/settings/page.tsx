import { verifyRestaurantAdmin } from '@/lib/auth/restaurant-dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import SettingsForm, { type Settings } from './settings-form'

export default async function RestaurantAdminSettingsPage() {
  const session = await verifyRestaurantAdmin()
  const admin = createSupabaseAdminClient()

  const { data, error } = await admin
    .from('restaurant_settings')
    .select(
      'logo_url, banner_url, primary_color, secondary_color, whatsapp_number, instagram_url, facebook_url, minimum_order_amount, is_accepting_orders',
    )
    .eq('restaurant_id', session.restaurantId)
    .maybeSingle<Settings>()

  if (error) {
    console.error('[settings] query failed', error)
  }

  const settings = data ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Settings for {session.restaurantName}.
        </p>
      </div>

      {!settings ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No restaurant_settings row found for this restaurant.
        </div>
      ) : (
        <SettingsForm settings={settings} />
      )}
    </div>
  )
}
