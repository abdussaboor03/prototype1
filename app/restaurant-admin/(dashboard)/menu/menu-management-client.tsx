'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCategory,
  updateCategory,
  setCategoryActive,
  createMenuItem,
  updateMenuItem,
  setMenuItemAvailable,
} from './actions'

export type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  sort_order: number
  is_active: boolean
}

export type MenuItem = {
  id: string
  category_id: string | null
  name: string
  slug: string
  description: string | null
  image_url: string | null
  price: number
  sort_order: number
  is_available: boolean
}

const pkr = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
})

type CategoryModalState =
  | { mode: 'create' }
  | { mode: 'edit'; data: Category }
  | null

type MenuItemModalState =
  | { mode: 'create' }
  | { mode: 'edit'; data: MenuItem }
  | null

export default function MenuManagementClient({
  categories,
  menuItems,
}: {
  categories: Category[]
  menuItems: MenuItem[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [catModal, setCatModal] = useState<CategoryModalState>(null)
  const [itemModal, setItemModal] = useState<MenuItemModalState>(null)

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

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.id, c.name)
    return m
  }, [categories])

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function toggleCategory(c: Category) {
    setActionError(null)
    const r = await setCategoryActive(c.id, !c.is_active)
    if (r.ok) refresh()
    else setActionError(r.error)
  }

  async function toggleMenuItem(i: MenuItem) {
    setActionError(null)
    const r = await setMenuItemAvailable(i.id, !i.is_available)
    if (r.ok) refresh()
    else setActionError(r.error)
  }

  return (
    <div className="space-y-8">
      {actionError ? (
        <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {/* Categories */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <header className="flex items-center justify-between border-b border-zinc-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Categories</h2>
            <p className="text-xs text-zinc-500">
              {categories.length} categor
              {categories.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCatModal({ mode: 'create' })}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Add category
          </button>
        </header>
        {categories.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No categories yet. Add one to start building your menu.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Slug</th>
                <th className="px-4 py-2">Sort</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-zinc-900">
                    {c.name}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600">
                    {c.slug}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{c.sort_order}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        c.is_active
                          ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                          : 'rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600'
                      }
                    >
                      {c.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCatModal({ mode: 'edit', data: c })
                        }
                        className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCategory(c)}
                        className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Menu items */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <header className="flex items-center justify-between border-b border-zinc-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Menu items</h2>
            <p className="text-xs text-zinc-500">
              {menuItems.length} item{menuItems.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setItemModal({ mode: 'create' })}
            disabled={categories.length === 0}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Add menu item
          </button>
        </header>
        {categories.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            Add a category first.
          </div>
        ) : menuItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No menu items yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {categories.map((cat) => {
              const items = itemsByCategory.get(cat.id) ?? []
              if (items.length === 0) return null
              return (
                <div key={cat.id} className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {cat.name}
                    {!cat.is_active ? (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] normal-case text-zinc-600">
                        category inactive
                      </span>
                    ) : null}
                  </p>
                  <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200">
                    {items.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-start gap-3 p-3 text-sm"
                      >
                        {it.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.image_url}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded bg-zinc-100" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <p className="font-medium text-zinc-900">
                              {it.name}
                            </p>
                            <span className="font-mono text-xs text-zinc-500">
                              {it.slug}
                            </span>
                            <span
                              className={
                                it.is_available
                                  ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                                  : 'rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600'
                              }
                            >
                              {it.is_available ? 'available' : 'unavailable'}
                            </span>
                          </div>
                          {it.description ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                              {it.description}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-xs text-zinc-500">
                            sort {it.sort_order}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {pkr.format(Number(it.price))}
                          </p>
                          <div className="mt-2 inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setItemModal({ mode: 'edit', data: it })
                              }
                              className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleMenuItem(it)}
                              className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                            >
                              {it.is_available ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
            {/* Items in inactive/missing categories — defensive listing */}
            {(() => {
              const orphans = menuItems.filter(
                (it) => !it.category_id || !categoryNameById.has(it.category_id),
              )
              if (orphans.length === 0) return null
              return (
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Uncategorised
                  </p>
                  <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-amber-200">
                    {orphans.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-center justify-between p-3 text-sm"
                      >
                        <span>{it.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setItemModal({ mode: 'edit', data: it })
                          }
                          className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          Edit
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}
          </div>
        )}
      </section>

      {catModal ? (
        <CategoryModal
          state={catModal}
          onClose={() => setCatModal(null)}
          onSaved={() => {
            setCatModal(null)
            refresh()
          }}
        />
      ) : null}

      {itemModal ? (
        <MenuItemModal
          state={itemModal}
          categories={categories}
          onClose={() => setItemModal(null)}
          onSaved={() => {
            setItemModal(null)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function CategoryModal({
  state,
  onClose,
  onSaved,
}: {
  state: Exclude<CategoryModalState, null>
  onClose: () => void
  onSaved: () => void
}) {
  const initial = state.mode === 'edit' ? state.data : null
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    const payload = {
      name,
      slug,
      description: description || null,
      image_url: imageUrl || null,
      sort_order: Number(sortOrder) || 0,
    }
    const r =
      state.mode === 'create'
        ? await createCategory(payload)
        : await updateCategory({ id: initial!.id, ...payload })
    setSubmitting(false)
    if (r.ok) onSaved()
    else setError(r.error)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={() => {
        if (!submitting) onClose()
      }}
    >
      <div
        className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 p-4">
          <h3 className="text-lg font-semibold">
            {state.mode === 'create' ? 'Add category' : 'Edit category'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Description{' '}
              <span className="text-zinc-400">(optional)</span>
            </label>
            <textarea
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Image URL <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              type="url"
              value={imageUrl ?? ''}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Sort order
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>

          {error ? (
            <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {submitting
                ? 'Saving…'
                : state.mode === 'create'
                  ? 'Create'
                  : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MenuItemModal({
  state,
  categories,
  onClose,
  onSaved,
}: {
  state: Exclude<MenuItemModalState, null>
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const initial = state.mode === 'edit' ? state.data : null
  const [categoryId, setCategoryId] = useState(
    initial?.category_id ?? categories[0]?.id ?? '',
  )
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [price, setPrice] = useState(String(initial?.price ?? ''))
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    const payload = {
      category_id: categoryId,
      name,
      slug,
      description: description || null,
      image_url: imageUrl || null,
      price: Number(price),
      sort_order: Number(sortOrder) || 0,
    }
    const r =
      state.mode === 'create'
        ? await createMenuItem(payload)
        : await updateMenuItem({ id: initial!.id, ...payload })
    setSubmitting(false)
    if (r.ok) onSaved()
    else setError(r.error)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={() => {
        if (!submitting) onClose()
      }}
    >
      <div
        className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 p-4">
          <h3 className="text-lg font-semibold">
            {state.mode === 'create' ? 'Add menu item' : 'Edit menu item'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 p-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.is_active ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Description{' '}
              <span className="text-zinc-400">(optional)</span>
            </label>
            <textarea
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Image URL <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              type="url"
              value={imageUrl ?? ''}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Price (PKR)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Sort order
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {submitting
                ? 'Saving…'
                : state.mode === 'create'
                  ? 'Create'
                  : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
