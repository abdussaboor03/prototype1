import { verifyRestaurantAdmin } from '@/lib/auth/restaurant-dal'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
})

type OrderRow = {
  placed_at: string
  total_amount: number
  order_status: string
}

export default async function RestaurantAdminAnalyticsPage() {
  const session = await verifyRestaurantAdmin()
  const admin = createSupabaseAdminClient()

  const now = new Date()
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  )
  // "This week" = last 7 days including today → today plus 6 prior days.
  const thisWeekStart = new Date(todayStart)
  thisWeekStart.setDate(thisWeekStart.getDate() - 6)
  // "Last week" = the 7 days before this week.
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  // Fetch the union range (last week start → now), bucket in JS.
  const { data, error } = await admin
    .from('orders')
    .select('placed_at, total_amount, order_status')
    .eq('restaurant_id', session.restaurantId)
    .gte('placed_at', lastWeekStart.toISOString())
    .lte('placed_at', now.toISOString())
    .neq('order_status', 'cancelled')

  if (error) {
    console.error('[analytics] orders query failed', error)
  }

  const rows = (data ?? []) as OrderRow[]

  let todayCount = 0
  let todayRevenue = 0
  let thisWeekCount = 0
  let thisWeekRevenue = 0
  let lastWeekCount = 0
  let lastWeekRevenue = 0

  for (const r of rows) {
    const placed = new Date(r.placed_at)
    const total = Number(r.total_amount) || 0
    if (placed >= thisWeekStart) {
      thisWeekCount += 1
      thisWeekRevenue += total
      if (placed >= todayStart) {
        todayCount += 1
        todayRevenue += total
      }
    } else if (placed >= lastWeekStart) {
      lastWeekCount += 1
      lastWeekRevenue += total
    }
  }

  const cards: { label: string; count: number; revenue: number }[] = [
    { label: 'Today', count: todayCount, revenue: todayRevenue },
    { label: 'This week', count: thisWeekCount, revenue: thisWeekRevenue },
    { label: 'Last week', count: lastWeekCount, revenue: lastWeekRevenue },
  ]

  // ─── Breakdown tables (all-time, non-cancelled) ──────────────────────
  const { data: nonCancelledOrders, error: ncErr } = await admin
    .from('orders')
    .select('id, order_source')
    .eq('restaurant_id', session.restaurantId)
    .neq('order_status', 'cancelled')

  if (ncErr) {
    console.error('[analytics] non-cancelled orders query failed', ncErr)
  }

  const ncRows = (nonCancelledOrders ?? []) as {
    id: string
    order_source: string
  }[]
  const allOrderIds = ncRows.map((o) => o.id)

  let topItems: { name: string; quantity: number }[] = []
  if (allOrderIds.length > 0) {
    const { data: itemRows, error: iErr } = await admin
      .from('order_items')
      .select('item_name_snapshot, quantity')
      .eq('restaurant_id', session.restaurantId)
      .in('order_id', allOrderIds)
    if (iErr) {
      console.error('[analytics] order_items query failed', iErr)
    }
    const itemTotals = new Map<string, number>()
    for (const r of (itemRows ?? []) as {
      item_name_snapshot: string | null
      quantity: number
    }[]) {
      const name = r.item_name_snapshot ?? '—'
      itemTotals.set(
        name,
        (itemTotals.get(name) ?? 0) + (Number(r.quantity) || 0),
      )
    }
    topItems = [...itemTotals.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }

  const sourceCounts = new Map<string, number>()
  for (const o of ncRows) {
    const s = o.order_source ?? 'unknown'
    sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1)
  }
  const ordersBySource = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  const { data: paymentRows, error: pErr } = await admin
    .from('payments')
    .select('payment_method, amount, payment_status')
    .eq('restaurant_id', session.restaurantId)
    .neq('payment_status', 'failed')

  if (pErr) {
    console.error('[analytics] payments query failed', pErr)
  }

  type PaymentBucket = { count: number; amount: number }
  const paymentBuckets = new Map<string, PaymentBucket>()
  for (const p of (paymentRows ?? []) as {
    payment_method: string
    amount: number
  }[]) {
    const m = p.payment_method ?? 'unknown'
    const cur = paymentBuckets.get(m) ?? { count: 0, amount: 0 }
    cur.count += 1
    cur.amount += Number(p.amount) || 0
    paymentBuckets.set(m, cur)
  }
  const paymentBreakdown = [...paymentBuckets.entries()]
    .map(([method, b]) => ({ method, ...b }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Order summary for {session.restaurantName}. Cancelled orders are
          excluded.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-zinc-200 bg-white p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">
              {c.count.toLocaleString('en-PK')}
            </p>
            <p className="text-xs text-zinc-500">
              order{c.count === 1 ? '' : 's'}
            </p>
            <p className="mt-3 text-lg font-semibold text-zinc-900">
              {pkr.format(c.revenue)}
            </p>
            <p className="text-xs text-zinc-500">revenue</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <header className="border-b border-zinc-200 p-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Top 5 selling items
          </h2>
          <p className="text-xs text-zinc-500">
            All-time, cancelled orders excluded.
          </p>
        </header>
        {topItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No items sold yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {topItems.map((it) => (
                <tr key={it.name}>
                  <td className="px-4 py-2 font-medium text-zinc-900">
                    {it.name}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-700">
                    {it.quantity.toLocaleString('en-PK')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <header className="border-b border-zinc-200 p-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Orders by source
          </h2>
          <p className="text-xs text-zinc-500">
            All-time, cancelled orders excluded.
          </p>
        </header>
        {ordersBySource.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No orders yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2 text-right">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {ordersBySource.map((s) => (
                <tr key={s.source}>
                  <td className="px-4 py-2 capitalize text-zinc-900">
                    {s.source}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-700">
                    {s.count.toLocaleString('en-PK')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <header className="border-b border-zinc-200 p-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Payment method breakdown
          </h2>
          <p className="text-xs text-zinc-500">
            All-time, failed payments excluded (includes pending — see notes).
          </p>
        </header>
        {paymentBreakdown.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No payments yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2 text-right">Payments</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {paymentBreakdown.map((p) => (
                <tr key={p.method}>
                  <td className="px-4 py-2 capitalize text-zinc-900">
                    {p.method}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-700">
                    {p.count.toLocaleString('en-PK')}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-700">
                    {pkr.format(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
