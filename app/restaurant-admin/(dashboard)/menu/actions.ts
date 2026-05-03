'use server'

import { revalidatePath } from 'next/cache'
import { verifyRestaurantAdmin } from '@/lib/auth/restaurant-dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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

type Result = { ok: true } | { ok: false; error: string }

const SLUG_ERROR =
  'Slug must be lowercase letters, numbers, and hyphens only (no spaces, no leading/trailing hyphens).'

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === '23505'
  )
}

function bumpRevalidations() {
  revalidatePath('/restaurant-admin/menu')
}

// ─── Categories ────────────────────────────────────────────────────────

export type CategoryFormInput = {
  name: string
  slug: string
  description?: string | null
  image_url?: string | null
  sort_order?: number
}

export async function createCategory(input: CategoryFormInput): Promise<Result> {
  const session = await verifyRestaurantAdmin()
  const name = String(input?.name ?? '').trim()
  const slug = normalizeSlug(String(input?.slug ?? ''))
  if (!name) return { ok: false, error: 'Name is required.' }
  if (!slug) return { ok: false, error: 'Slug is required.' }
  if (!SLUG_RE.test(slug)) return { ok: false, error: SLUG_ERROR }
  const sortOrder = Math.max(0, Math.floor(Number(input?.sort_order ?? 0) || 0))

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('categories').insert({
    restaurant_id: session.restaurantId,
    name,
    slug,
    description: input.description?.toString().trim() || null,
    image_url: input.image_url?.toString().trim() || null,
    sort_order: sortOrder,
    is_active: true,
  })
  if (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'A category with that slug already exists.' }
    }
    console.error('[create-category] failed', error)
    return { ok: false, error: 'Failed to create category.' }
  }
  bumpRevalidations()
  return { ok: true }
}

export async function updateCategory(
  input: CategoryFormInput & { id: string },
): Promise<Result> {
  const session = await verifyRestaurantAdmin()
  const id = String(input?.id ?? '')
  const name = String(input?.name ?? '').trim()
  const slug = normalizeSlug(String(input?.slug ?? ''))
  if (!id) return { ok: false, error: 'Invalid category.' }
  if (!name) return { ok: false, error: 'Name is required.' }
  if (!slug) return { ok: false, error: 'Slug is required.' }
  if (!SLUG_RE.test(slug)) return { ok: false, error: SLUG_ERROR }
  const sortOrder = Math.max(0, Math.floor(Number(input?.sort_order ?? 0) || 0))

  const admin = createSupabaseAdminClient()
  const { data: existing } = await admin
    .from('categories')
    .select('id, restaurant_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing || existing.restaurant_id !== session.restaurantId) {
    return { ok: false, error: 'Category not found.' }
  }

  const { error } = await admin
    .from('categories')
    .update({
      name,
      slug,
      description: input.description?.toString().trim() || null,
      image_url: input.image_url?.toString().trim() || null,
      sort_order: sortOrder,
    })
    .eq('id', id)
    .eq('restaurant_id', session.restaurantId)

  if (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'A category with that slug already exists.' }
    }
    console.error('[update-category] failed', error)
    return { ok: false, error: 'Failed to update category.' }
  }
  bumpRevalidations()
  return { ok: true }
}

export async function setCategoryActive(
  id: string,
  isActive: boolean,
): Promise<Result> {
  const session = await verifyRestaurantAdmin()
  if (!id) return { ok: false, error: 'Invalid category.' }
  const admin = createSupabaseAdminClient()
  const { data: existing } = await admin
    .from('categories')
    .select('id, restaurant_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing || existing.restaurant_id !== session.restaurantId) {
    return { ok: false, error: 'Category not found.' }
  }
  const { error } = await admin
    .from('categories')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('restaurant_id', session.restaurantId)
  if (error) {
    console.error('[set-category-active] failed', error)
    return { ok: false, error: 'Failed to update category.' }
  }
  bumpRevalidations()
  return { ok: true }
}

// ─── Menu items ────────────────────────────────────────────────────────

export type MenuItemFormInput = {
  category_id: string
  name: string
  slug: string
  description?: string | null
  image_url?: string | null
  price: number | string
  sort_order?: number
}

export async function createMenuItem(input: MenuItemFormInput): Promise<Result> {
  const session = await verifyRestaurantAdmin()
  const name = String(input?.name ?? '').trim()
  const slug = normalizeSlug(String(input?.slug ?? ''))
  const categoryId = String(input?.category_id ?? '')
  if (!name) return { ok: false, error: 'Name is required.' }
  if (!slug) return { ok: false, error: 'Slug is required.' }
  if (!SLUG_RE.test(slug)) return { ok: false, error: SLUG_ERROR }
  if (!categoryId) return { ok: false, error: 'Category is required.' }
  const price = Number(input?.price)
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: 'Price must be a non-negative number.' }
  }
  const sortOrder = Math.max(0, Math.floor(Number(input?.sort_order ?? 0) || 0))

  const admin = createSupabaseAdminClient()
  const { data: cat } = await admin
    .from('categories')
    .select('id, restaurant_id')
    .eq('id', categoryId)
    .maybeSingle()
  if (!cat || cat.restaurant_id !== session.restaurantId) {
    return { ok: false, error: 'Invalid category.' }
  }

  const { error } = await admin.from('menu_items').insert({
    restaurant_id: session.restaurantId,
    category_id: categoryId,
    name,
    slug,
    description: input.description?.toString().trim() || null,
    image_url: input.image_url?.toString().trim() || null,
    price,
    sort_order: sortOrder,
    is_available: true,
  })
  if (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'A menu item with that slug already exists.' }
    }
    console.error('[create-menu-item] failed', error)
    return { ok: false, error: 'Failed to create menu item.' }
  }
  bumpRevalidations()
  return { ok: true }
}

export async function updateMenuItem(
  input: MenuItemFormInput & { id: string },
): Promise<Result> {
  const session = await verifyRestaurantAdmin()
  const id = String(input?.id ?? '')
  const name = String(input?.name ?? '').trim()
  const slug = normalizeSlug(String(input?.slug ?? ''))
  const categoryId = String(input?.category_id ?? '')
  if (!id) return { ok: false, error: 'Invalid menu item.' }
  if (!name) return { ok: false, error: 'Name is required.' }
  if (!slug) return { ok: false, error: 'Slug is required.' }
  if (!SLUG_RE.test(slug)) return { ok: false, error: SLUG_ERROR }
  if (!categoryId) return { ok: false, error: 'Category is required.' }
  const price = Number(input?.price)
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: 'Price must be a non-negative number.' }
  }
  const sortOrder = Math.max(0, Math.floor(Number(input?.sort_order ?? 0) || 0))

  const admin = createSupabaseAdminClient()
  const { data: existing } = await admin
    .from('menu_items')
    .select('id, restaurant_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing || existing.restaurant_id !== session.restaurantId) {
    return { ok: false, error: 'Menu item not found.' }
  }
  const { data: cat } = await admin
    .from('categories')
    .select('id, restaurant_id')
    .eq('id', categoryId)
    .maybeSingle()
  if (!cat || cat.restaurant_id !== session.restaurantId) {
    return { ok: false, error: 'Invalid category.' }
  }

  const { error } = await admin
    .from('menu_items')
    .update({
      category_id: categoryId,
      name,
      slug,
      description: input.description?.toString().trim() || null,
      image_url: input.image_url?.toString().trim() || null,
      price,
      sort_order: sortOrder,
    })
    .eq('id', id)
    .eq('restaurant_id', session.restaurantId)

  if (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'A menu item with that slug already exists.' }
    }
    console.error('[update-menu-item] failed', error)
    return { ok: false, error: 'Failed to update menu item.' }
  }
  bumpRevalidations()
  return { ok: true }
}

export async function setMenuItemAvailable(
  id: string,
  isAvailable: boolean,
): Promise<Result> {
  const session = await verifyRestaurantAdmin()
  if (!id) return { ok: false, error: 'Invalid menu item.' }
  const admin = createSupabaseAdminClient()
  const { data: existing } = await admin
    .from('menu_items')
    .select('id, restaurant_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing || existing.restaurant_id !== session.restaurantId) {
    return { ok: false, error: 'Menu item not found.' }
  }
  const { error } = await admin
    .from('menu_items')
    .update({ is_available: isAvailable })
    .eq('id', id)
    .eq('restaurant_id', session.restaurantId)
  if (error) {
    console.error('[set-menu-item-available] failed', error)
    return { ok: false, error: 'Failed to update menu item.' }
  }
  bumpRevalidations()
  return { ok: true }
}
