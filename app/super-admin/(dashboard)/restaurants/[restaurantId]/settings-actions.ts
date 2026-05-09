'use server'

import { revalidatePath } from 'next/cache'
import { verifySuperAdmin } from '@/lib/auth/dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type Result = { ok: true } | { ok: false; error: string }

export type SuperAdminSettingsInput = {
  logo_url?: string | null
  banner_url?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  whatsapp_number?: string | null
  instagram_url?: string | null
  facebook_url?: string | null
  minimum_order_amount: number | string
  is_accepting_orders: boolean
}

function nullable(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

export async function updateRestaurantSettings(
  restaurantId: string,
  input: SuperAdminSettingsInput,
): Promise<Result> {
  await verifySuperAdmin()

  if (!restaurantId || typeof restaurantId !== 'string') {
    return { ok: false, error: 'Invalid restaurant.' }
  }

  const minOrder = Number(input?.minimum_order_amount)
  if (!Number.isFinite(minOrder) || minOrder < 0) {
    return {
      ok: false,
      error: 'Minimum order amount must be a non-negative number.',
    }
  }
  const isAccepting = !!input?.is_accepting_orders

  const admin = createSupabaseAdminClient()

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('id', restaurantId)
    .maybeSingle<{ id: string; slug: string }>()

  if (rErr) {
    console.error('[super-admin/update-settings] restaurant lookup failed', rErr)
    return { ok: false, error: 'Failed to verify restaurant.' }
  }
  if (!restaurant) {
    return { ok: false, error: 'Restaurant not found.' }
  }

  const { data: existing, error: fetchErr } = await admin
    .from('restaurant_settings')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[super-admin/update-settings] fetch failed', fetchErr)
    return { ok: false, error: 'Failed to load settings.' }
  }
  if (!existing) {
    return {
      ok: false,
      error: 'No settings row exists for this restaurant.',
    }
  }

  const { error } = await admin
    .from('restaurant_settings')
    .update({
      logo_url: nullable(input.logo_url),
      banner_url: nullable(input.banner_url),
      primary_color: nullable(input.primary_color),
      secondary_color: nullable(input.secondary_color),
      whatsapp_number: nullable(input.whatsapp_number),
      instagram_url: nullable(input.instagram_url),
      facebook_url: nullable(input.facebook_url),
      minimum_order_amount: minOrder,
      is_accepting_orders: isAccepting,
    })
    .eq('restaurant_id', restaurantId)

  if (error) {
    console.error('[super-admin/update-settings] update failed', error)
    return { ok: false, error: 'Failed to save settings.' }
  }

  revalidatePath(`/super-admin/restaurants/${restaurantId}`)
  revalidatePath(`/${restaurant.slug}`)
  return { ok: true }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function timeOrNull(v: unknown): string | null | 'invalid' {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (t === '') return null
  if (TIME_RE.test(t)) return t
  if (/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(t)) return t.slice(0, 5)
  return 'invalid'
}

export type SuperAdminBranchInput = {
  opening_time?: string | null
  closing_time?: string | null
  is_accepting_orders: boolean
  is_active: boolean
}

export async function updateRestaurantBranch(
  restaurantId: string,
  branchId: string,
  input: SuperAdminBranchInput,
): Promise<Result> {
  await verifySuperAdmin()

  if (!restaurantId || typeof restaurantId !== 'string') {
    return { ok: false, error: 'Invalid restaurant.' }
  }
  if (!branchId || typeof branchId !== 'string') {
    return { ok: false, error: 'Invalid branch.' }
  }

  const opening = timeOrNull(input.opening_time)
  if (opening === 'invalid') {
    return { ok: false, error: 'Opening time must be HH:MM.' }
  }
  const closing = timeOrNull(input.closing_time)
  if (closing === 'invalid') {
    return { ok: false, error: 'Closing time must be HH:MM.' }
  }
  const isAccepting = !!input?.is_accepting_orders
  const isActive = !!input?.is_active

  const admin = createSupabaseAdminClient()

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('id', restaurantId)
    .maybeSingle<{ id: string; slug: string }>()

  if (rErr) {
    console.error('[super-admin/update-branch] restaurant lookup failed', rErr)
    return { ok: false, error: 'Failed to verify restaurant.' }
  }
  if (!restaurant) {
    return { ok: false, error: 'Restaurant not found.' }
  }

  const { data: branch, error: bErr } = await admin
    .from('branches')
    .select('id, restaurant_id')
    .eq('id', branchId)
    .maybeSingle<{ id: string; restaurant_id: string }>()

  if (bErr) {
    console.error('[super-admin/update-branch] branch lookup failed', bErr)
    return { ok: false, error: 'Failed to load branch.' }
  }
  if (!branch || branch.restaurant_id !== restaurantId) {
    return { ok: false, error: 'Branch not found.' }
  }

  const { error } = await admin
    .from('branches')
    .update({
      opening_time: opening,
      closing_time: closing,
      is_accepting_orders: isAccepting,
      is_active: isActive,
    })
    .eq('id', branchId)
    .eq('restaurant_id', restaurantId)

  if (error) {
    console.error('[super-admin/update-branch] update failed', error)
    return { ok: false, error: 'Failed to save branch.' }
  }

  revalidatePath(`/super-admin/restaurants/${restaurantId}`)
  revalidatePath(`/${restaurant.slug}`)
  return { ok: true }
}
