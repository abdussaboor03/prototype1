import { verifyRestaurantAdmin } from '@/lib/auth/restaurant-dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import MenuManagementClient, {
  type Category,
  type MenuItem,
} from './menu-management-client'

export default async function RestaurantAdminMenuPage() {
  const session = await verifyRestaurantAdmin()
  const admin = createSupabaseAdminClient()

  const [catRes, itemsRes] = await Promise.all([
    admin
      .from('categories')
      .select(
        'id, name, slug, description, image_url, sort_order, is_active',
      )
      .eq('restaurant_id', session.restaurantId)
      .order('sort_order')
      .order('name'),
    admin
      .from('menu_items')
      .select(
        'id, category_id, name, slug, description, image_url, price, sort_order, is_available',
      )
      .eq('restaurant_id', session.restaurantId)
      .order('sort_order')
      .order('name'),
  ])

  if (catRes.error) {
    console.error('[menu] categories query failed', catRes.error)
  }
  if (itemsRes.error) {
    console.error('[menu] menu_items query failed', itemsRes.error)
  }

  const categories = (catRes.data ?? []) as Category[]
  const menuItems = (itemsRes.data ?? []) as MenuItem[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Menu</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage categories and menu items for {session.restaurantName}.
        </p>
      </div>
      <MenuManagementClient
        categories={categories}
        menuItems={menuItems}
      />
    </div>
  )
}
