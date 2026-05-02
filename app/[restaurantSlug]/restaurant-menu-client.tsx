'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  placeOrder,
  type OrderType,
  type PaymentMethod,
  type PlacedOrder,
} from './actions'

type Category = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  sort_order: number
}

type MenuItem = {
  id: string
  category_id: string | null
  name: string
  description: string | null
  image_url: string | null
  price: number
  is_available: boolean
  sort_order: number
}

type ModifierGroup = {
  id: string
  menu_item_id: string
  name: string
  is_required: boolean
  min_select: number
  max_select: number
  sort_order: number
}

type Modifier = {
  id: string
  modifier_group_id: string
  name: string
  price_delta: number
  sort_order: number
}

type SelectedModifier = { id: string; name: string; price_delta: number }

type CartItem = {
  key: string
  menu_item_id: string
  item_name: string
  base_price: number
  selected_modifiers: SelectedModifier[]
  quantity: number
  unit_total: number
  line_total: number
}

const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
})

function buildKey(menuItemId: string, modIds: string[]) {
  return `${menuItemId}|${[...modIds].sort().join(',')}`
}

function withTotals(item: CartItem): CartItem {
  const unit =
    item.base_price +
    item.selected_modifiers.reduce((s, m) => s + Number(m.price_delta), 0)
  return { ...item, unit_total: unit, line_total: unit * item.quantity }
}

export default function RestaurantMenuClient({
  restaurantSlug,
  primaryColor,
  categories,
  menuItems,
  modifierGroups,
  modifiers,
}: {
  restaurantSlug: string
  primaryColor: string
  categories: Category[]
  menuItems: MenuItem[]
  modifierGroups: ModifierGroup[]
  modifiers: Modifier[]
}) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null)
  const [selection, setSelection] = useState<Record<string, string[]>>({})
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showCart, setShowCart] = useState(false)

  const [showCheckout, setShowCheckout] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<PlacedOrder | null>(null)

  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [custEmail, setCustEmail] = useState('')
  const [orderType, setOrderType] = useState<OrderType>('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')

  const storageKey = `cart:${restaurantSlug}`

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setCart(parsed as CartItem[])
      }
    } catch {
      // ignore — corrupt cart resets to empty
    }
    setHydrated(true)
  }, [storageKey])

  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(cart))
    } catch {
      // ignore quota errors
    }
  }, [cart, hydrated, storageKey])

  const groupsByItem = useMemo(() => {
    const m = new Map<string, ModifierGroup[]>()
    for (const g of modifierGroups) {
      const list = m.get(g.menu_item_id) ?? []
      list.push(g)
      m.set(g.menu_item_id, list)
    }
    for (const list of m.values())
      list.sort((a, b) => a.sort_order - b.sort_order)
    return m
  }, [modifierGroups])

  const modifiersByGroup = useMemo(() => {
    const m = new Map<string, Modifier[]>()
    for (const x of modifiers) {
      const list = m.get(x.modifier_group_id) ?? []
      list.push(x)
      m.set(x.modifier_group_id, list)
    }
    for (const list of m.values())
      list.sort((a, b) => a.sort_order - b.sort_order)
    return m
  }, [modifiers])

  const itemsByCategory = useMemo(() => {
    const m = new Map<string, MenuItem[]>()
    for (const it of menuItems) {
      if (!it.category_id) continue
      const list = m.get(it.category_id) ?? []
      list.push(it)
      m.set(it.category_id, list)
    }
    return m
  }, [menuItems])

  const subtotal = cart.reduce((s, c) => s + c.line_total, 0)
  const deliveryFee = 0
  const total = subtotal + deliveryFee
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  function openItem(item: MenuItem) {
    setActiveItem(item)
    setValidationError(null)
    const groups = groupsByItem.get(item.id) ?? []
    const init: Record<string, string[]> = {}
    for (const g of groups) init[g.id] = []
    setSelection(init)
  }

  function closeItem() {
    setActiveItem(null)
    setValidationError(null)
  }

  function toggleModifier(group: ModifierGroup, modId: string) {
    setValidationError(null)
    setSelection((prev) => {
      const current = prev[group.id] ?? []
      const has = current.includes(modId)
      let next: string[]
      if (group.max_select <= 1) {
        next = has ? [] : [modId]
      } else if (has) {
        next = current.filter((id) => id !== modId)
      } else if (current.length >= group.max_select) {
        return prev
      } else {
        next = [...current, modId]
      }
      return { ...prev, [group.id]: next }
    })
  }

  function addToCart() {
    if (!activeItem) return
    const groups = groupsByItem.get(activeItem.id) ?? []

    for (const g of groups) {
      const sel = selection[g.id] ?? []
      const minRequired = g.is_required
        ? Math.max(1, g.min_select)
        : g.min_select
      if (sel.length < minRequired) {
        setValidationError(
          `Please choose at least ${minRequired} from "${g.name}".`,
        )
        return
      }
      if (sel.length > g.max_select) {
        setValidationError(
          `Please choose at most ${g.max_select} from "${g.name}".`,
        )
        return
      }
    }

    const selectedMods: SelectedModifier[] = []
    for (const g of groups) {
      const sel = selection[g.id] ?? []
      const groupMods = modifiersByGroup.get(g.id) ?? []
      for (const id of sel) {
        const m = groupMods.find((x) => x.id === id)
        if (m)
          selectedMods.push({
            id: m.id,
            name: m.name,
            price_delta: Number(m.price_delta),
          })
      }
    }

    const key = buildKey(
      activeItem.id,
      selectedMods.map((m) => m.id),
    )

    setCart((prev) => {
      const existing = prev.find((c) => c.key === key)
      if (existing) {
        return prev.map((c) =>
          c.key === key ? withTotals({ ...c, quantity: c.quantity + 1 }) : c,
        )
      }
      return [
        ...prev,
        withTotals({
          key,
          menu_item_id: activeItem.id,
          item_name: activeItem.name,
          base_price: Number(activeItem.price),
          selected_modifiers: selectedMods,
          quantity: 1,
          unit_total: 0,
          line_total: 0,
        }),
      ]
    })
    closeItem()
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((c) => {
        if (c.key !== key) return [c]
        const next = c.quantity + delta
        if (next <= 0) return []
        return [withTotals({ ...c, quantity: next })]
      }),
    )
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key))
  }

  function openCheckout() {
    setShowCart(false)
    setShowCheckout(true)
    setOrderError(null)
  }

  async function submitOrder() {
    if (placing) return
    if (!custName.trim()) return setOrderError('Name is required.')
    if (!custPhone.trim()) return setOrderError('Phone is required.')
    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      return setOrderError('Delivery address is required.')
    }
    if (cart.length === 0) return setOrderError('Cart is empty.')

    setOrderError(null)
    setPlacing(true)
    try {
      const result = await placeOrder({
        restaurantSlug,
        customer: {
          name: custName.trim(),
          phone: custPhone.trim(),
          email: custEmail.trim() || null,
        },
        orderType,
        deliveryAddress:
          orderType === 'delivery' ? deliveryAddress.trim() : null,
        notes: notes.trim() || null,
        paymentMethod,
        cart: cart.map((c) => ({
          menu_item_id: c.menu_item_id,
          modifier_ids: c.selected_modifiers.map((m) => m.id),
          quantity: c.quantity,
        })),
      })
      if (result.ok) {
        setConfirmation(result.order)
        setShowCheckout(false)
        setCart([])
        try {
          sessionStorage.removeItem(storageKey)
        } catch {
          // ignore
        }
        setCustName('')
        setCustPhone('')
        setCustEmail('')
        setDeliveryAddress('')
        setNotes('')
      } else {
        setOrderError(result.error)
      }
    } catch (e) {
      console.error('[checkout] placeOrder failed', e)
      setOrderError('Could not place order. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  const hasMenu = categories.length > 0 && menuItems.length > 0

  return (
    <>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Menu</h2>

        {!hasMenu ? (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            The menu is not available yet. Please check back soon.
          </div>
        ) : (
          <div className="mt-4 space-y-8">
            {categories.map((cat) => {
              const items = itemsByCategory.get(cat.id) ?? []
              if (items.length === 0) return null
              return (
                <div key={cat.id}>
                  <h3
                    className="text-base font-semibold"
                    style={{ color: primaryColor }}
                  >
                    {cat.name}
                  </h3>
                  {cat.description ? (
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {cat.description}
                    </p>
                  ) : null}
                  <ul className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => openItem(item)}
                          className="flex w-full items-start gap-3 p-4 text-left hover:bg-zinc-50 sm:gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="truncate font-medium">
                                {item.name}
                              </p>
                              <p className="shrink-0 text-sm font-semibold">
                                {pkr.format(Number(item.price))}
                              </p>
                            </div>
                            {item.description ? (
                              <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                          {item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image_url}
                              alt=""
                              className="h-16 w-16 shrink-0 rounded-md object-cover sm:h-20 sm:w-20"
                            />
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Sticky cart bar */}
      {cart.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="text-sm text-zinc-600">
              {cartCount} item{cartCount === 1 ? '' : 's'} ·{' '}
              <span className="font-semibold text-zinc-900">
                {pkr.format(total)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              View cart
            </button>
          </div>
        </div>
      ) : null}

      {/* Item modal */}
      {activeItem ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={closeItem}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {activeItem.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeItem.image_url}
                alt=""
                className="h-48 w-full object-cover sm:rounded-t-2xl"
              />
            ) : null}
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{activeItem.name}</h3>
                <button
                  type="button"
                  onClick={closeItem}
                  className="text-zinc-400 hover:text-zinc-700"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {activeItem.description ? (
                <p className="mt-1 text-sm text-zinc-600">
                  {activeItem.description}
                </p>
              ) : null}
              <p className="mt-2 text-sm font-semibold">
                {pkr.format(Number(activeItem.price))}
              </p>

              {(groupsByItem.get(activeItem.id) ?? []).map((g) => {
                const groupMods = modifiersByGroup.get(g.id) ?? []
                const sel = selection[g.id] ?? []
                const isSingle = g.max_select <= 1
                return (
                  <div key={g.id} className="mt-5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">{g.name}</h4>
                      <span className="text-xs text-zinc-500">
                        {g.is_required ? 'Required' : 'Optional'} ·{' '}
                        {isSingle
                          ? 'choose 1'
                          : `choose ${g.min_select}–${g.max_select}`}
                      </span>
                    </div>
                    <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200">
                      {groupMods.map((m) => {
                        const checked = sel.includes(m.id)
                        return (
                          <li key={m.id}>
                            <label className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-zinc-50">
                              <input
                                type={isSingle ? 'radio' : 'checkbox'}
                                name={g.id}
                                checked={checked}
                                onChange={() => toggleModifier(g, m.id)}
                                className="h-4 w-4"
                              />
                              <span className="flex-1">{m.name}</span>
                              {Number(m.price_delta) !== 0 ? (
                                <span className="text-zinc-500">
                                  {Number(m.price_delta) > 0 ? '+' : ''}
                                  {pkr.format(Number(m.price_delta))}
                                </span>
                              ) : null}
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}

              {validationError ? (
                <p className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700">
                  {validationError}
                </p>
              ) : null}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={closeItem}
                  className="flex-1 rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addToCart}
                  className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Add to cart
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cart panel */}
      {showCart ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setShowCart(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 p-4">
              <h3 className="text-lg font-semibold">Your cart</h3>
              <button
                type="button"
                onClick={() => setShowCart(false)}
                className="text-zinc-400 hover:text-zinc-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  Your cart is empty.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {cart.map((c) => (
                    <li key={c.key} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{c.item_name}</p>
                          {c.selected_modifiers.length > 0 ? (
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {c.selected_modifiers
                                .map((m) => m.name)
                                .join(', ')}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-zinc-500">
                            {pkr.format(c.unit_total)} each
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          {pkr.format(c.line_total)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-md border border-zinc-200">
                          <button
                            type="button"
                            onClick={() => changeQty(c.key, -1)}
                            className="px-3 py-1 text-zinc-700 hover:bg-zinc-50"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="px-3 text-sm">{c.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeQty(c.key, 1)}
                            className="px-3 py-1 text-zinc-700 hover:bg-zinc-50"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(c.key)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {cart.length > 0 ? (
              <div className="border-t border-zinc-200 p-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span>{pkr.format(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Delivery fee</span>
                    <span>{pkr.format(deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                    <span>Total</span>
                    <span>{pkr.format(total)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openCheckout}
                  className="mt-4 w-full rounded-md px-4 py-2.5 text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Checkout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Checkout panel */}
      {showCheckout ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => {
            if (!placing) setShowCheckout(false)
          }}
        >
          <div
            className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 p-4">
              <h3 className="text-lg font-semibold">Checkout</h3>
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                disabled={placing}
                className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submitOrder()
              }}
              className="p-4"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">
                    Email <span className="text-zinc-400">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-zinc-700">
                    Order type
                  </span>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {(['pickup', 'delivery'] as const).map((t) => (
                      <label
                        key={t}
                        className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm capitalize ${
                          orderType === t
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="order_type"
                          value={t}
                          checked={orderType === t}
                          onChange={() => setOrderType(t)}
                          className="sr-only"
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>

                {orderType === 'delivery' ? (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">
                      Delivery address
                    </label>
                    <textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      required
                      rows={2}
                      className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="block text-xs font-medium text-zinc-700">
                    Notes <span className="text-zinc-400">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-zinc-700">
                    Payment method
                  </span>
                  <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      ['cash', 'easypaisa', 'jazzcash', 'card'] as const
                    ).map((p) => (
                      <label
                        key={p}
                        className={`cursor-pointer rounded-md border px-2 py-2 text-center text-xs capitalize ${
                          paymentMethod === p
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment_method"
                          value={p}
                          checked={paymentMethod === p}
                          onChange={() => setPaymentMethod(p)}
                          className="sr-only"
                        />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-md border border-zinc-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Order summary
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {cart.map((c) => (
                    <li
                      key={c.key}
                      className="flex items-start justify-between gap-2"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {c.quantity} × {c.item_name}
                      </span>
                      <span className="shrink-0">
                        {pkr.format(c.line_total)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-zinc-200 pt-2 text-sm">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span>{pkr.format(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Delivery fee</span>
                    <span>{pkr.format(deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                    <span>Total</span>
                    <span>{pkr.format(total)}</span>
                  </div>
                </div>
              </div>

              {orderError ? (
                <p className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700">
                  {orderError}
                </p>
              ) : null}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  disabled={placing}
                  className="flex-1 rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={placing}
                  className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: primaryColor }}
                >
                  {placing ? 'Placing order…' : 'Place order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Order confirmation */}
      {confirmation ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setConfirmation(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                ✓
              </div>
              <h3 className="mt-3 text-lg font-semibold">Order placed!</h3>
              <p className="mt-1 text-sm text-zinc-600">
                {confirmation.restaurant_name}
              </p>

              <dl className="mt-5 space-y-2 rounded-md border border-zinc-200 p-4 text-left text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Order #</dt>
                  <dd className="font-mono font-medium">
                    {confirmation.order_number}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Status</dt>
                  <dd className="capitalize">{confirmation.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Payment</dt>
                  <dd className="capitalize">{confirmation.payment_method}</dd>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{pkr.format(confirmation.total)}</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => setConfirmation(null)}
                className="mt-5 w-full rounded-md px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
