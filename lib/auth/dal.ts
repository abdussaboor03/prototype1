import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type SuperAdminSession = {
  userId: string
  email: string | null
  fullName: string | null
}

export const verifySuperAdmin = cache(async (): Promise<SuperAdminSession> => {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/super-admin/login')
  }

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('user_id, email, full_name, user_role, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  if (
    !platformUser ||
    !platformUser.is_active ||
    !['super_admin', 'platform_owner'].includes(platformUser.user_role)
  ) {
    redirect('/super-admin/login?error=not_authorized')
  }

  return {
    userId: platformUser.user_id,
    email: platformUser.email,
    fullName: platformUser.full_name,
  }
})
