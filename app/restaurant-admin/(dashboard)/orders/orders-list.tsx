'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrderStatus } from './actions'

export type StatusFilter =
  | 'all'
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'

type SelectedModifier = { id: string; name: string; price_delta: number }

type OrderItem = {
  id: string
  item_name_snapshot: string
  unit_price_snapshot: number
  quantity: number
  selected_modifiers: SelectedModifier[] | null
  subtotal: number
}

type Payment = {
  payment_method: string
  payment_status: string
}

export type OrderRow = {
  id: string
  order_number: string
  customer_name: string | null
  customer_phone: string | null
  order_type: string
  order_status: string
  subtotal: number
  delivery_fee: number
  total_amount: number
  delivery_address: string | null
  notes: string | null
  placed_at: string
  branch_id: string | null
  order_items: OrderItem[]
  payments: Payment[]
}

const TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'out_for_delivery'],
  out_for_delivery: ['completed'],
  cancelled: [],
  completed: [],
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-indigo-100 text-indigo-800',
  ready: 'bg-emerald-100 text-emerald-800',
  out_for_delivery: 'bg-violet-100 text-violet-800',
  completed: 'bg-zinc-200 text-zinc-700',
  cancelled: 'bg-red-100 text-red-700',
}

const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
})

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function OrdersList({ orders }: { orders: OrderRow[] }) {
  const router = useRouter()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingTransition, startTransition] = useTransition()

  const activeOrder = activeId
    ? (orders.find((o) => o.id === activeId) ?? null)
    : null

  function open(id: string) {
    setActiveId(id)
    setError(null)
  }
  function close() {
    setActiveId(null)
    setError(null)
  }

  async function changeStatus(orderId: string, next: string) {
    setError(null)
    const result = await updateOrderStatus(orderId, next)
    if (result.ok) {
      // Pull fresh server-rendered data; the modal stays bound to activeId.
      startTransition(() => router.refresh())
    } else {
      setError(result.error)
    }
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
        No orders to show.
      </div>
    )
  }

  return (
    <>
      <ul className="grid gap-3">
        {orders.map((o) => {
          const itemCount = o.order_items.reduce(
            (s, i) => s + i.quantity,
            0,
          )
          const payment = o.payments[0]
          return (
            <li
              key={o.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold text-zinc-900">
                      {o.order_number}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[o.order_status] ?? 'bg-zinc-100 text-zinc-700'}`}
                    >
                      {STATUS_LABELS[o.order_status] ?? o.order_status}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize text-zinc-700">
                      {o.order_type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-700">
                    {o.customer_name ?? 'Guest'}
                    {o.customer_phone ? ` · ${o.customer_phone}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatTime(o.placed_at)} · {itemCount} item
                    {itemCount === 1 ? '' : 's'}
                    {payment
                      ? ` · ${payment.payment_method} (${payment.payment_status})`
                      : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-zinc-900">
                    {pkr.format(Number(o.total_amount))}
                  </p>
                  <button
                    type="button"
                    onClick={() => open(o.id)}
                    className="mt-2 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    View
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {activeOrder ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={close}
        >
          <div
            className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-zinc-200 p-4">
              <div>
                <p className="font-mono text-sm font-semibold">
                  {activeOrder.order_number}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatTime(activeOrder.placed_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-zinc-400 hover:text-zinc-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[activeOrder.order_status] ?? 'bg-zinc-100 text-zinc-700'}`}
                >
                  {STATUS_LABELS[activeOrder.order_status] ??
                    activeOrder.order_status}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 capitalize text-zinc-700">
                  {activeOrder.order_type}
                </span>
                {activeOrder.payments[0] ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 capitalize text-zinc-700">
                    {activeOrder.payments[0].payment_method} ·{' '}
                    {activeOrder.payments[0].payment_status}
                  </span>
                ) : null}
              </div>

              <div className="text-sm">
                <p className="font-medium text-zinc-900">
                  {activeOrder.customer_name ?? 'Guest'}
                </p>
                {activeOrder.customer_phone ? (
                  <p className="text-zinc-600">{activeOrder.customer_phone}</p>
                ) : null}
                {activeOrder.order_type === 'delivery' &&
                activeOrder.delivery_address ? (
                  <p className="mt-2 whitespace-pre-line text-zinc-600">
                    {activeOrder.delivery_address}
                  </p>
                ) : null}
                {activeOrder.notes ? (
                  <p className="mt-2 rounded-md bg-zinc-50 p-2 text-zinc-700">
                    Notes: {activeOrder.notes}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Items
                </p>
                <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200">
                  {activeOrder.order_items.map((it) => (
                    <li key={it.id} className="p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {it.quantity} × {it.item_name_snapshot}
                          </p>
                          {Array.isArray(it.selected_modifiers) &&
                          it.selected_modifiers.length > 0 ? (
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {it.selected_modifiers
                                .map((m) => m.name)
                                .join(', ')}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {pkr.format(Number(it.unit_price_snapshot))} each
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {pkr.format(Number(it.subtotal))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1 rounded-md border border-zinc-200 p-3 text-sm">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span>{pkr.format(Number(activeOrder.subtotal))}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Delivery fee</span>
                  <span>{pkr.format(Number(activeOrder.delivery_fee))}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span>{pkr.format(Number(activeOrder.total_amount))}</span>
                </div>
              </div>

              {error ? (
                <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              {(TRANSITIONS[activeOrder.order_status] ?? []).length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Update status
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(TRANSITIONS[activeOrder.order_status] ?? []).map(
                      (next) => (
                        <button
                          key={next}
                          type="button"
                          disabled={pendingTransition}
                          onClick={() => changeStatus(activeOrder.id, next)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                            next === 'cancelled'
                              ? 'border border-red-200 bg-white text-red-700 hover:bg-red-50'
                              : 'bg-zinc-900 text-white hover:bg-zinc-800'
                          }`}
                        >
                          {pendingTransition ? '…' : `→ ${STATUS_LABELS[next] ?? next}`}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  This order is in a final state.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
