'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { verifyRestaurantAdmin } from '@/lib/auth/restaurant-dal'

const TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'out_for_delivery'],
  out_for_delivery: ['completed'],
  cancelled: [],
  completed: [],
}

export type UpdateOrderStatusResult =
  | { ok: true }
  | { ok: false; error: string }

export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
): Promise<UpdateOrderStatusResult> {
  // Re-verify the caller — never trust client-supplied identity/role/branch.
  const session = await verifyRestaurantAdmin()

  if (!orderId || typeof orderId !== 'string') {
    return { ok: false, error: 'Invalid order.' }
  }

  const admin = createSupabaseAdminClient()

  const { data: order, error: fetchErr } = await admin
    .from('orders')
    .select('id, restaurant_id, branch_id, order_status')
    .eq('id', orderId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[update-order-status] fetch failed', fetchErr)
    return { ok: false, error: 'Failed to load order.' }
  }
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.restaurant_id !== session.restaurantId) {
    return { ok: false, error: 'Order not found.' }
  }
  if (session.branchId && order.branch_id !== session.branchId) {
    return { ok: false, error: 'Order not found.' }
  }

  const allowed = TRANSITIONS[order.order_status as string] ?? []
  if (!allowed.includes(newStatus)) {
    return {
      ok: false,
      error: `Cannot move order from "${order.order_status}" to "${newStatus}".`,
    }
  }

  const { error: updErr } = await admin
    .from('orders')
    .update({ order_status: newStatus })
    .eq('id', orderId)

  if (updErr) {
    console.error('[update-order-status] update failed', updErr)
    return { ok: false, error: 'Failed to update order status.' }
  }

  const { error: histErr } = await admin
    .from('order_status_history')
    .insert({
      restaurant_id: session.restaurantId,
      order_id: orderId,
      from_status: order.order_status,
      to_status: newStatus,
      changed_by: session.userId,
    })

  if (histErr) {
    console.error('[update-order-status] history insert failed', histErr)
    // Non-critical: the status change is already persisted.
  }

  revalidatePath('/restaurant-admin/orders')
  return { ok: true }
}
