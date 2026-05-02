'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { verifySuperAdmin } from '@/lib/auth/dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const ALLOWED_PLANS = ['free', 'starter', 'pro', 'enterprise'] as const
type PlanType = (typeof ALLOWED_PLANS)[number]

export type CreateRestaurantState = { error: string } | undefined

function str(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

function strOrNull(form: FormData, name: string) {
  const v = str(form, name)
  return v === '' ? null : v
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createRestaurant(
  _prev: CreateRestaurantState,
  formData: FormData,
): Promise<CreateRestaurantState> {
  await verifySuperAdmin()

  const name = str(formData, 'name')
  const slug = normalizeSlug(str(formData, 'slug'))
  const email = strOrNull(formData, 'email')
  const phone = strOrNull(formData, 'phone')
  const planRaw = str(formData, 'plan_type') || 'free'

  const branchName = str(formData, 'branch_name')
  const branchSlug = normalizeSlug(str(formData, 'branch_slug'))
  const branchAddress = strOrNull(formData, 'branch_address')
  const branchPhone = strOrNull(formData, 'branch_phone')
  const openingTime = strOrNull(formData, 'opening_time')
  const closingTime = strOrNull(formData, 'closing_time')

  const logoUrl = strOrNull(formData, 'logo_url')
  const bannerUrl = strOrNull(formData, 'banner_url')
  const primaryColor = str(formData, 'primary_color') || '#000000'
  const secondaryColor = str(formData, 'secondary_color') || '#ffffff'
  const whatsappNumber = strOrNull(formData, 'whatsapp_number')

  const minOrderRaw = str(formData, 'minimum_order_amount')
  const minimumOrderAmount = minOrderRaw === '' ? 0 : Number(minOrderRaw)

  if (!name) return { error: 'Restaurant name is required.' }
  if (!slug) return { error: 'Restaurant slug is required.' }
  if (!SLUG_RE.test(slug)) {
    return {
      error:
        'Restaurant slug must be lowercase letters, numbers, and hyphens only (no spaces, no leading/trailing hyphens).',
    }
  }
  if (!branchName) return { error: 'Branch name is required.' }
  if (!branchSlug) return { error: 'Branch slug is required.' }
  if (!SLUG_RE.test(branchSlug)) {
    return {
      error:
        'Branch slug must be lowercase letters, numbers, and hyphens only (no spaces, no leading/trailing hyphens).',
    }
  }
  if (!ALLOWED_PLANS.includes(planRaw as PlanType)) {
    return { error: 'Plan type must be free, starter, pro, or enterprise.' }
  }
  if (Number.isNaN(minimumOrderAmount) || minimumOrderAmount < 0) {
    return { error: 'Minimum order amount must be a non-negative number.' }
  }

  const admin = createSupabaseAdminClient()

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .insert({
      name,
      slug,
      email,
      phone,
      plan_type: planRaw as PlanType,
    })
    .select('id')
    .single()

  if (rErr || !restaurant) {
    return { error: rErr?.message ?? 'Failed to create restaurant.' }
  }

  const { error: sErr } = await admin.from('restaurant_settings').insert({
    restaurant_id: restaurant.id,
    logo_url: logoUrl,
    banner_url: bannerUrl,
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    whatsapp_number: whatsappNumber,
    minimum_order_amount: minimumOrderAmount,
  })

  if (sErr) {
    await admin.from('restaurants').delete().eq('id', restaurant.id)
    return { error: `Settings: ${sErr.message}` }
  }

  const { error: bErr } = await admin.from('branches').insert({
    restaurant_id: restaurant.id,
    name: branchName,
    slug: branchSlug,
    address: branchAddress,
    phone: branchPhone,
    opening_time: openingTime,
    closing_time: closingTime,
  })

  if (bErr) {
    await admin.from('restaurants').delete().eq('id', restaurant.id)
    return { error: `Branch: ${bErr.message}` }
  }

  revalidatePath('/super-admin/restaurants')
  redirect('/super-admin/restaurants')
}
