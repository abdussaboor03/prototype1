'use server'

import { revalidatePath } from 'next/cache'
import { verifySuperAdmin } from '@/lib/auth/dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type Result = { ok: true } | { ok: false; error: string }

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const SLUG_ERROR =
  'Slug must be lowercase letters, numbers, and hyphens only (no leading/trailing hyphens).'

function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505'
  )
}

function safeSortOrder(v: unknown): number {
  const n = Math.floor(Number(v ?? 0))
  if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) return 0
  return n
}

type LoadedRestaurant =
  | { ok: true; admin: ReturnType<typeof createSupabaseAdminClient>; restaurant: { id: string; slug: string } }
  | { ok: false; error: string }

async function loadRestaurant(restaurantId: string): Promise<LoadedRestaurant> {
  if (!restaurantId || typeof restaurantId !== 'string') {
    return { ok: false, error: 'Invalid restaurant.' }
  }
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('id', restaurantId)
    .maybeSingle<{ id: string; slug: string }>()
  if (error) {
    console.error('[super-admin/menu-actions] restaurant lookup failed', error)
    return { ok: false, error: 'Failed to verify restaurant.' }
  }
  if (!data) return { ok: false, error: 'Restaurant not found.' }
  return { ok: true, admin, restaurant: data }
}

function bumpRevalidations(restaurantId: string, restaurantSlug: string) {
  revalidatePath(`/super-admin/restaurants/${restaurantId}`)
  revalidatePath(`/${restaurantSlug}`)
}

export type SuperAdminCategoryInput = {
  name: string
  slug: string
  sort_order?: number | string
}

export async function createSuperAdminCategory(
  restaurantId: string,
  input: SuperAdminCategoryInput,
): Promise<Result> {
  await verifySuperAdmin()

  const loaded = await loadRestaurant(restaurantId)
  if (!loaded.ok) return { ok: false, error: loaded.error }
  const { admin, restaurant } = loaded

  const name = String(input?.name ?? '').trim()
  const slug = normalizeSlug(String(input?.slug ?? ''))
  if (!name) return { ok: false, error: 'Name is required.' }
  if (!slug) return { ok: false, error: 'Slug is required.' }
  if (!SLUG_RE.test(slug)) return { ok: false, error: SLUG_ERROR }
  const sortOrder = safeSortOrder(input?.sort_order)

  const { error } = await admin.from('categories').insert({
    restaurant_id: restaurant.id,
    name,
    slug,
    sort_order: sortOrder,
    is_active: true,
  })
  if (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'A category with that slug already exists.' }
    }
    console.error('[super-admin/create-category] failed', error)
    return { ok: false, error: 'Failed to create category.' }
  }

  bumpRevalidations(restaurant.id, restaurant.slug)
  return { ok: true }
}

export async function updateSuperAdminCategory(
  restaurantId: string,
  categoryId: string,
  input: SuperAdminCategoryInput,
): Promise<Result> {
  await verifySuperAdmin()

  if (!categoryId || typeof categoryId !== 'string') {
    return { ok: false, error: 'Invalid category.' }
  }

  const loaded = await loadRestaurant(restaurantId)
  if (!loaded.ok) return { ok: false, error: loaded.error }
  const { admin, restaurant } = loaded

  const name = String(input?.name ?? '').trim()
  const slug = normalizeSlug(String(input?.slug ?? ''))
  if (!name) return { ok: false, error: 'Name is required.' }
  if (!slug) return { ok: false, error: 'Slug is required.' }
  if (!SLUG_RE.test(slug)) return { ok: false, error: SLUG_ERROR }
  const sortOrder = safeSortOrder(input?.sort_order)

  const { data: existing, error: fetchErr } = await admin
    .from('categories')
    .select('id, restaurant_id')
    .eq('id', categoryId)
    .maybeSingle<{ id: string; restaurant_id: string }>()
  if (fetchErr) {
    console.error('[super-admin/update-category] fetch failed', fetchErr)
    return { ok: false, error: 'Failed to load category.' }
  }
  if (!existing || existing.restaurant_id !== restaurant.id) {
    return { ok: false, error: 'Category not found.' }
  }

  const { error } = await admin
    .from('categories')
    .update({ name, slug, sort_order: sortOrder })
    .eq('id', categoryId)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'A category with that slug already exists.' }
    }
    console.error('[super-admin/update-category] failed', error)
    return { ok: false, error: 'Failed to update category.' }
  }

  bumpRevalidations(restaurant.id, restaurant.slug)
  return { ok: true }
}

export async function toggleSuperAdminCategoryActive(
  restaurantId: string,
  categoryId: string,
  isActive: boolean,
): Promise<Result> {
  await verifySuperAdmin()

  if (!categoryId || typeof categoryId !== 'string') {
    return { ok: false, error: 'Invalid category.' }
  }

  const loaded = await loadRestaurant(restaurantId)
  if (!loaded.ok) return { ok: false, error: loaded.error }
  const { admin, restaurant } = loaded

  const { data: existing, error: fetchErr } = await admin
    .from('categories')
    .select('id, restaurant_id')
    .eq('id', categoryId)
    .maybeSingle<{ id: string; restaurant_id: string }>()
  if (fetchErr) {
    console.error('[super-admin/toggle-category] fetch failed', fetchErr)
    return { ok: false, error: 'Failed to load category.' }
  }
  if (!existing || existing.restaurant_id !== restaurant.id) {
    return { ok: false, error: 'Category not found.' }
  }

  const { error } = await admin
    .from('categories')
    .update({ is_active: !!isActive })
    .eq('id', categoryId)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    console.error('[super-admin/toggle-category] update failed', error)
    return { ok: false, error: 'Failed to update category.' }
  }

  bumpRevalidations(restaurant.id, restaurant.slug)
  return { ok: true }
}
