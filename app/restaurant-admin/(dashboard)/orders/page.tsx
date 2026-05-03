import Link from 'next/link'
import { verifyRestaurantAdmin } from '@/lib/auth/restaurant-dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import OrdersList, { type OrderRow, type StatusFilter } from './orders-list'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const VALID_STATUS = new Set(STATUS_TABS.map((t) => t.key))

export default async function RestaurantAdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await verifyRestaurantAdmin()
  const sp = await searchParams
  const status: StatusFilter = VALID_STATUS.has(sp.status as StatusFilter)
    ? (sp.status as StatusFilter)
    : 'all'

  const admin = createSupabaseAdminClient()
  let query = admin
    .from('orders')
    .select(
      `
      id, order_number, customer_name, customer_phone, order_type,
      order_status, subtotal, delivery_fee, total_amount,
      delivery_address, notes, placed_at, branch_id,
      order_items(
        id, item_name_snapshot, unit_price_snapshot, quantity,
        selected_modifiers, subtotal
      ),
      payments(payment_method, payment_status)
    `,
    )
    .eq('restaurant_id', session.restaurantId)
    .order('placed_at', { ascending: false })

  if (session.branchId) query = query.eq('branch_id', session.branchId)
  if (status !== 'all') query = query.eq('order_status', status)

  const { data, error } = await query

  if (error) {
    console.error('[restaurant-admin/orders] query failed', error)
  }

  const orders = (data ?? []) as OrderRow[]

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Orders</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {session.branchName
              ? `Branch: ${session.branchName}`
              : 'All branches'}{' '}
            · {orders.length} order{orders.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={
              t.key === 'all'
                ? '/restaurant-admin/orders'
                : `/restaurant-admin/orders?status=${t.key}`
            }
            className={
              status === t.key
                ? 'rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white'
                : 'rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50'
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <OrdersList orders={orders} />
    </div>
  )
}
