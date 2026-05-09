'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSuperAdminCategory,
  toggleSuperAdminCategoryActive,
  updateSuperAdminCategory,
} from './menu-actions'

export type SuperAdminCategory = {
  id: string
  name: string
  slug: string
  sort_order: number | null
  is_active: boolean
}

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; data: SuperAdminCategory }
  | null

export default function SuperAdminCategoryManager({
  restaurantId,
  restaurantSlug,
  categories,
}: {
  restaurantId: string
  restaurantSlug: string
  categories: SuperAdminCategory[]
}) {
  void restaurantSlug

  const router = useRouter()
  const [, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function toggle(c: SuperAdminCategory) {
    if (togglingId) return
    setActionError(null)
    setTogglingId(c.id)
    const r = await toggleSuperAdminCategoryActive(
      restaurantId,
      c.id,
      !c.is_active,
    )
    setTogglingId(null)
    if (r.ok) refresh()
    else setActionError(r.error)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">Categories</p>
        <button
          type="button"
          onClick={() => {
            setActionError(null)
            setModal({ mode: 'create' })
          }}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Add category
        </button>
      </div>

      {actionError ? (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}

      {categories.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
          No categories yet. Add one to start building this menu.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Sort</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium text-zinc-900">
                    {c.name}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                    {c.slug}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">
                    {c.sort_order ?? 0}
                  </td>
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActionError(null)
                          setModal({ mode: 'edit', data: c })
                        }}
                        className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(c)}
                        disabled={togglingId === c.id}
                        className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {togglingId === c.id
                          ? '…'
                          : c.is_active
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <CategoryModal
          state={modal}
          restaurantId={restaurantId}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function CategoryModal({
  state,
  restaurantId,
  onClose,
  onSaved,
}: {
  state: Exclude<ModalState, null>
  restaurantId: string
  onClose: () => void
  onSaved: () => void
}) {
  const initial = state.mode === 'edit' ? state.data : null
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
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
      sort_order: Number(sortOrder) || 0,
    }
    const r =
      state.mode === 'create'
        ? await createSuperAdminCategory(restaurantId, payload)
        : await updateSuperAdminCategory(restaurantId, initial!.id, payload)
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
