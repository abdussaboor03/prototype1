import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const RESTAURANT_ROLES = [
  'owner',
  'admin',
  'manager',
  'staff',
  'cashier',
] as const
export type RestaurantRole = (typeof RESTAURANT_ROLES)[number]

export type RestaurantAdminSession = {
  userId: string
  email: string | null
  role: RestaurantRole
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  branchId: string | null
  branchName: string | null
}

type LinkRow = {
  user_id: string
  user_role: string
  is_active: boolean
  restaurant_id: string
  branch_id: string | null
  restaurant:
    | { id: string; name: string; slug: string; is_active: boolean }
    | null
  branch: { id: string; name: string } | null
}

export const verifyRestaurantAdmin = cache(
  async (): Promise<RestaurantAdminSession> => {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect('/restaurant-admin/login')

    // restaurant_users has no public RLS read policy, so we use the
    // service-role client server-side, scoped to the verified user.id.
    // This is not authorization bypass — we only read the row that
    // matches the already-authenticated user.
    const admin = createSupabaseAdminClient()
    const { data: rows } = await admin
      .from('restaurant_users')
      .select(
        `
        user_id, user_role, is_active, restaurant_id, branch_id,
        restaurant:restaurants(id, name, slug, is_active),
        branch:branches(id, name)
      `,
      )
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)

    const link = (rows?.[0] ?? null) as LinkRow | null

    if (
      !link ||
      !(RESTAURANT_ROLES as readonly string[]).includes(link.user_role) ||
      !link.restaurant ||
      !link.restaurant.is_active
    ) {
      // Cookies are read-only in RSC — redirect through the sign-out
      // route handler, which can clear the session and bounce to login.
      redirect('/restaurant-admin/sign-out?reason=not_authorized')
    }

    return {
      userId: link.user_id,
      email: user.email ?? null,
      role: link.user_role as RestaurantRole,
      restaurantId: link.restaurant_id,
      restaurantName: link.restaurant!.name,
      restaurantSlug: link.restaurant!.slug,
      branchId: link.branch_id,
      branchName: link.branch?.name ?? null,
    }
  },
)
