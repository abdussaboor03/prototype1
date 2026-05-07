'use server'

import { revalidatePath } from 'next/cache'
import { verifyRestaurantAdmin } from '@/lib/auth/restaurant-dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type Result = { ok: true } | { ok: false; error: string }

export type SettingsFormInput = {
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

export async function updateSettings(
  input: SettingsFormInput,
): Promise<Result> {
  const session = await verifyRestaurantAdmin()

  const minOrder = Number(input?.minimum_order_amount)
  if (!Number.isFinite(minOrder) || minOrder < 0) {
    return {
      ok: false,
      error: 'Minimum order amount must be a non-negative number.',
    }
  }
  const isAccepting = !!input?.is_accepting_orders

  const admin = createSupabaseAdminClient()

  const { data: existing, error: fetchErr } = await admin
    .from('restaurant_settings')
    .select('id')
    .eq('restaurant_id', session.restaurantId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[update-settings] fetch failed', fetchErr)
    return { ok: false, error: 'Failed to load settings.' }
  }
  if (!existing) {
    return {
      ok: false,
      error:
        'No settings row exists for this restaurant. Ask a super admin to create one.',
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
    .eq('restaurant_id', session.restaurantId)

  if (error) {
    console.error('[update-settings] update failed', error)
    return { ok: false, error: 'Failed to save settings.' }
  }

  revalidatePath('/restaurant-admin/settings')
  return { ok: true }
}
