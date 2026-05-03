'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { RESTAURANT_ROLES } from '@/lib/auth/restaurant-dal'

export type RestaurantLoginState = { error: string } | undefined

export async function signIn(
  _prev: RestaurantLoginState,
  formData: FormData,
): Promise<RestaurantLoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    console.error(
      '[restaurant-admin signIn] supabase error:',
      error?.message,
      error?.status,
    )
    return { error: 'Invalid email or password.' }
  }

  // restaurant_users has no public read policy — use service role,
  // scoped to the freshly authenticated user.id only.
  const admin = createSupabaseAdminClient()
  const { data: rows } = await admin
    .from('restaurant_users')
    .select('user_role, is_active, restaurant:restaurants(is_active)')
    .eq('user_id', data.user.id)
    .eq('is_active', true)
    .limit(1)

  const link = rows?.[0] as
    | {
        user_role: string
        is_active: boolean
        restaurant: { is_active: boolean } | null
      }
    | undefined

  if (
    !link ||
    !(RESTAURANT_ROLES as readonly string[]).includes(link.user_role) ||
    !link.restaurant ||
    !link.restaurant.is_active
  ) {
    await supabase.auth.signOut()
    return { error: 'This account does not have restaurant admin access.' }
  }

  redirect('/restaurant-admin')
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/restaurant-admin/login')
}
