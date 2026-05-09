'use server'

import { revalidatePath } from 'next/cache'
import { verifySuperAdmin } from '@/lib/auth/dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const ALLOWED_PLANS = ['free', 'starter', 'pro', 'enterprise'] as const
type PlanType = (typeof ALLOWED_PLANS)[number]

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type UpdateRestaurantState = {
  error?: string
  success?: boolean
}

function str(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

function strOrNull(form: FormData, name: string) {
  const v = str(form, name)
  return v === '' ? null : v
}

export async function updateRestaurant(
  _prev: UpdateRestaurantState | undefined,
  formData: FormData,
): Promise<UpdateRestaurantState> {
  await verifySuperAdmin()

  const id = str(formData, 'id')
  if (!id) return { error: 'Restaurant id is required.' }

  const name = str(formData, 'name')
  const slug = str(formData, 'slug').toLowerCase()
  const email = strOrNull(formData, 'email')
  const phone = strOrNull(formData, 'phone')
  const planRaw = str(formData, 'plan_type')
  const isActive = str(formData, 'is_active') === 'on'

  if (!name) return { error: 'Restaurant name is required.' }
  if (!slug) return { error: 'Restaurant slug is required.' }
  if (!SLUG_RE.test(slug)) {
    return {
      error:
        'Slug must be lowercase letters, numbers, and hyphens only (no leading or trailing hyphen).',
    }
  }
  if (!ALLOWED_PLANS.includes(planRaw as PlanType)) {
    return { error: 'Plan type must be free, starter, pro, or enterprise.' }
  }

  const admin = createSupabaseAdminClient()

  const { data: existing, error: fetchErr } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('id', id)
    .maybeSingle<{ id: string; slug: string }>()

  if (fetchErr) {
    return { error: fetchErr.message }
  }
  if (!existing) {
    return { error: 'Restaurant not found.' }
  }

  const { error: updErr } = await admin
    .from('restaurants')
    .update({
      name,
      slug,
      email,
      phone,
      plan_type: planRaw as PlanType,
      is_active: isActive,
    })
    .eq('id', id)

  if (updErr) {
    return { error: updErr.message }
  }

  revalidatePath('/super-admin/restaurants')
  revalidatePath(`/super-admin/restaurants/${id}`)
  revalidatePath(`/${existing.slug}`)
  if (slug !== existing.slug) {
    revalidatePath(`/${slug}`)
  }

  return { success: true }
}
