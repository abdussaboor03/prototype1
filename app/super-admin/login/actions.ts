'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type LoginState = { error: string } | undefined

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
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
      '[super-admin signIn] supabase error:',
      error?.message,
      error?.status,
    )
    return { error: 'Invalid email or password.' }
  }

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('user_role, is_active')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (
    !platformUser ||
    !platformUser.is_active ||
    !['super_admin', 'platform_owner'].includes(platformUser.user_role)
  ) {
    await supabase.auth.signOut()
    return { error: 'This account does not have super admin access.' }
  }

  redirect('/super-admin')
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/super-admin/login')
}
