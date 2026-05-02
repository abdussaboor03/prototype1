'use server'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const ORDER_TYPES = ['delivery', 'pickup'] as const
const PAYMENT_METHODS = ['cash', 'easypaisa', 'jazzcash', 'card'] as const

export type OrderType = (typeof ORDER_TYPES)[number]
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export type PlaceOrderInput = {
  restaurantSlug: string
  customer: { name: string; phone: string; email?: string | null }
  orderType: OrderType
  deliveryAddress?: string | null
  notes?: string | null
  paymentMethod: PaymentMethod
  cart: Array<{
    menu_item_id: string
    modifier_ids: string[]
    quantity: number
  }>
}

export type PlacedOrder = {
  id: string
  order_number: string
  total: number
  status: string
  payment_method: string
  restaurant_name: string
}

export type PlaceOrderResult =
  | { ok: true; order: PlacedOrder }
  | { ok: false; error: string }

function generateOrderNumber() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0')
  return `ORD-${y}${m}${day}-${rand}`
}

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const slug = String(input?.restaurantSlug ?? '').trim()
  const name = String(input?.customer?.name ?? '').trim()
  const phone = String(input?.customer?.phone ?? '').trim()
  const email = input?.customer?.email
    ? String(input.customer.email).trim()
    : null
  const orderType = input?.orderType
  const paymentMethod = input?.paymentMethod
  const deliveryAddress = input?.deliveryAddress
    ? String(input.deliveryAddress).trim()
    : null
  const notes = input?.notes ? String(input.notes).trim() : null
  const cart = Array.isArray(input?.cart) ? input.cart : []

  if (!slug) return { ok: false, error: 'Missing restaurant.' }
  if (!name) return { ok: false, error: 'Name is required.' }
  if (!phone) return { ok: false, error: 'Phone is required.' }
  if (!ORDER_TYPES.includes(orderType)) {
    return { ok: false, error: 'Invalid order type.' }
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return { ok: false, error: 'Invalid payment method.' }
  }
  if (orderType === 'delivery' && !deliveryAddress) {
    return {
      ok: false,
      error: 'Delivery address is required for delivery orders.',
    }
  }
  if (cart.length === 0) return { ok: false, error: 'Cart is empty.' }
  for (const line of cart) {
    if (!line.menu_item_id || typeof line.menu_item_id !== 'string') {
      return { ok: false, error: 'Invalid cart item.' }
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return { ok: false, error: 'Invalid item quantity.' }
    }
    if (!Array.isArray(line.modifier_ids)) {
      return { ok: false, error: 'Invalid modifier selection.' }
    }
  }

  const admin = createSupabaseAdminClient()

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select('id, name, is_active')
    .eq('slug', slug)
    .maybeSingle()

  if (rErr) {
    console.error('[place-order] restaurant query failed', rErr)
    return { ok: false, error: 'Failed to verify restaurant.' }
  }
  if (!restaurant || !restaurant.is_active) {
    return { ok: false, error: 'This restaurant is not available.' }
  }

  const { data: settings, error: sErr } = await admin
    .from('restaurant_settings')
    .select('is_accepting_orders, minimum_order_amount')
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()

  if (sErr) {
    console.error('[place-order] settings query failed', sErr)
    return { ok: false, error: 'Failed to verify restaurant settings.' }
  }
  if (settings && settings.is_accepting_orders === false) {
    return {
      ok: false,
      error: 'This restaurant is not accepting orders right now.',
    }
  }

  const itemIds = [...new Set(cart.map((c) => c.menu_item_id))]
  const { data: items, error: iErr } = await admin
    .from('menu_items')
    .select('id, name, price, is_available, restaurant_id')
    .in('id', itemIds)

  if (iErr) {
    console.error('[place-order] menu_items query failed', iErr)
    return { ok: false, error: 'Failed to verify menu items.' }
  }

  type DbItem = {
    id: string
    name: string
    price: number
    is_available: boolean
    restaurant_id: string
  }
  const itemById = new Map<string, DbItem>(
    ((items ?? []) as DbItem[]).map((i) => [i.id, i]),
  )
  for (const id of itemIds) {
    const it = itemById.get(id)
    if (!it || it.restaurant_id !== restaurant.id || it.is_available !== true) {
      return {
        ok: false,
        error:
          'A selected item is no longer available. Please review your cart.',
      }
    }
  }

  const { data: groupRows, error: gErr } = await admin
    .from('modifier_groups')
    .select(
      'id, menu_item_id, restaurant_id, name, is_required, min_select, max_select',
    )
    .in('menu_item_id', itemIds)

  if (gErr) {
    console.error('[place-order] modifier_groups query failed', gErr)
    return { ok: false, error: 'Failed to verify modifiers.' }
  }

  type DbGroup = {
    id: string
    menu_item_id: string
    restaurant_id: string
    name: string
    is_required: boolean
    min_select: number
    max_select: number
  }
  const groups = (groupRows ?? []) as DbGroup[]
  const groupById = new Map<string, DbGroup>(groups.map((g) => [g.id, g]))
  const groupsByItem = new Map<string, DbGroup[]>()
  for (const g of groups) {
    if (g.restaurant_id !== restaurant.id) continue
    const list = groupsByItem.get(g.menu_item_id) ?? []
    list.push(g)
    groupsByItem.set(g.menu_item_id, list)
  }

  const allModIds = [...new Set(cart.flatMap((c) => c.modifier_ids))]
  type DbMod = {
    id: string
    name: string
    price_delta: number
    modifier_group_id: string
    restaurant_id: string
    is_available: boolean
  }
  const modById = new Map<string, DbMod>()
  if (allModIds.length > 0) {
    const { data: mods, error: mErr } = await admin
      .from('modifiers')
      .select(
        'id, name, price_delta, modifier_group_id, restaurant_id, is_available',
      )
      .in('id', allModIds)

    if (mErr) {
      console.error('[place-order] modifiers query failed', mErr)
      return { ok: false, error: 'Failed to verify modifier options.' }
    }

    for (const m of (mods ?? []) as DbMod[]) modById.set(m.id, m)
    for (const id of allModIds) {
      const m = modById.get(id)
      if (
        !m ||
        m.restaurant_id !== restaurant.id ||
        m.is_available !== true
      ) {
        return {
          ok: false,
          error:
            'A selected modifier is no longer available. Please review your cart.',
        }
      }
    }
  }

  type PreparedLine = {
    menu_item_id: string
    item_name: string
    quantity: number
    selected_modifiers: { id: string; name: string; price_delta: number }[]
    unit_price: number
    line_subtotal: number
  }
  const prepared: PreparedLine[] = []
  for (const line of cart) {
    const item = itemById.get(line.menu_item_id)!
    const itemGroups = groupsByItem.get(item.id) ?? []
    const selected = line.modifier_ids
      .map((id) => modById.get(id))
      .filter((m): m is DbMod => !!m)

    for (const m of selected) {
      const g = groupById.get(m.modifier_group_id)
      if (!g || g.menu_item_id !== item.id) {
        return {
          ok: false,
          error: 'A modifier does not belong to the selected item.',
        }
      }
    }

    const countByGroup = new Map<string, number>()
    for (const m of selected) {
      countByGroup.set(
        m.modifier_group_id,
        (countByGroup.get(m.modifier_group_id) ?? 0) + 1,
      )
    }
    for (const g of itemGroups) {
      const c = countByGroup.get(g.id) ?? 0
      const minRequired = g.is_required ? Math.max(1, g.min_select) : g.min_select
      if (c < minRequired) {
        return {
          ok: false,
          error: `"${item.name}" → "${g.name}" requires at least ${minRequired} selection(s).`,
        }
      }
      if (c > g.max_select) {
        return {
          ok: false,
          error: `"${item.name}" → "${g.name}" allows at most ${g.max_select} selection(s).`,
        }
      }
    }

    const basePrice = Number(item.price)
    const modTotal = selected.reduce((s, m) => s + Number(m.price_delta), 0)
    const unitPrice = basePrice + modTotal
    if (unitPrice < 0) {
      return { ok: false, error: 'Computed item price is invalid.' }
    }

    prepared.push({
      menu_item_id: item.id,
      item_name: item.name,
      quantity: line.quantity,
      selected_modifiers: selected.map((m) => ({
        id: m.id,
        name: m.name,
        price_delta: Number(m.price_delta),
      })),
      unit_price: unitPrice,
      line_subtotal: unitPrice * line.quantity,
    })
  }

  const subtotal = prepared.reduce((s, l) => s + l.line_subtotal, 0)
  const deliveryFee = 0
  const taxAmount = 0
  const totalAmount = subtotal + deliveryFee + taxAmount

  const minOrder = Number(settings?.minimum_order_amount ?? 0)
  if (minOrder > 0 && subtotal < minOrder) {
    return {
      ok: false,
      error: `Minimum order amount is ${minOrder}.`,
    }
  }

  const { data: branchRow } = await admin
    .from('branches')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .eq('is_accepting_orders', true)
    .order('name')
    .limit(1)
    .maybeSingle()

  const branchId = (branchRow?.id as string | undefined) ?? null

  let customerId: string | null = null
  const { data: existingCustomer } = await admin
    .from('customers')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('phone', phone)
    .maybeSingle()

  if (existingCustomer) {
    customerId = existingCustomer.id as string
  } else {
    const { data: newCustomer, error: cErr } = await admin
      .from('customers')
      .insert({
        restaurant_id: restaurant.id,
        name,
        phone,
        email,
      })
      .select('id')
      .single()
    if (cErr || !newCustomer) {
      console.error('[place-order] customer insert failed', cErr)
      return { ok: false, error: 'Failed to save customer.' }
    }
    customerId = newCustomer.id as string
  }

  let orderId: string | null = null
  let orderNumber = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    orderNumber = generateOrderNumber()
    const { data: order, error: oErr } = await admin
      .from('orders')
      .insert({
        restaurant_id: restaurant.id,
        branch_id: branchId,
        customer_id: customerId,
        order_number: orderNumber,
        order_type: orderType,
        order_status: 'pending',
        order_source: 'website',
        subtotal,
        tax_amount: taxAmount,
        delivery_fee: deliveryFee,
        discount_amount: 0,
        total_amount: totalAmount,
        customer_name: name,
        customer_phone: phone,
        delivery_address: orderType === 'delivery' ? deliveryAddress : null,
        notes,
      })
      .select('id')
      .single()

    if (!oErr && order) {
      orderId = order.id as string
      break
    }
    if (oErr && (oErr as { code?: string }).code === '23505') {
      continue
    }
    console.error('[place-order] order insert failed', oErr)
    return { ok: false, error: 'Failed to create order.' }
  }

  if (!orderId) {
    return { ok: false, error: 'Could not generate a unique order number.' }
  }

  const itemRows = prepared.map((l) => ({
    restaurant_id: restaurant.id,
    order_id: orderId,
    menu_item_id: l.menu_item_id,
    item_name_snapshot: l.item_name,
    unit_price_snapshot: l.unit_price,
    selected_modifiers: l.selected_modifiers,
    quantity: l.quantity,
    subtotal: l.line_subtotal,
  }))

  const { error: oiErr } = await admin.from('order_items').insert(itemRows)
  if (oiErr) {
    console.error('[place-order] order_items insert failed', oiErr)
    await admin.from('orders').delete().eq('id', orderId)
    return { ok: false, error: 'Failed to save order items.' }
  }

  const { error: pErr } = await admin.from('payments').insert({
    restaurant_id: restaurant.id,
    order_id: orderId,
    amount: totalAmount,
    payment_method: paymentMethod,
    payment_status: 'pending',
  })
  if (pErr) {
    console.error('[place-order] payment insert failed', pErr)
    await admin.from('orders').delete().eq('id', orderId)
    return { ok: false, error: 'Failed to save payment.' }
  }

  const { error: hErr } = await admin.from('order_status_history').insert({
    restaurant_id: restaurant.id,
    order_id: orderId,
    from_status: null,
    to_status: 'pending',
    note: 'Order placed',
  })
  if (hErr) {
    console.error('[place-order] status history insert failed', hErr)
    // Non-critical; order remains valid.
  }

  return {
    ok: true,
    order: {
      id: orderId,
      order_number: orderNumber,
      total: totalAmount,
      status: 'pending',
      payment_method: paymentMethod,
      restaurant_name: restaurant.name as string,
    },
  }
}
