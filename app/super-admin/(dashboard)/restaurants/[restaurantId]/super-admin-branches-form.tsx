'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateRestaurantBranch } from './settings-actions'

export type SuperAdminBranch = {
  id: string
  name: string
  opening_time: string | null
  closing_time: string | null
  is_accepting_orders: boolean
  is_active: boolean
}

function toTimeInput(t: string | null): string {
  if (!t) return ''
  return t.length >= 5 ? t.slice(0, 5) : t
}

export default function SuperAdminBranchesForm({
  restaurantId,
  restaurantSlug,
  branches,
}: {
  restaurantId: string
  restaurantSlug: string
  branches: SuperAdminBranch[]
}) {
  void restaurantSlug

  if (branches.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
        No branches yet for this restaurant.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {branches.map((b) => (
        <li key={b.id} className="py-4 first:pt-0 last:pb-0">
          <BranchRow restaurantId={restaurantId} branch={b} />
        </li>
      ))}
    </ul>
  )
}

function BranchRow({
  restaurantId,
  branch,
}: {
  restaurantId: string
  branch: SuperAdminBranch
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [openingTime, setOpeningTime] = useState(
    toTimeInput(branch.opening_time),
  )
  const [closingTime, setClosingTime] = useState(
    toTimeInput(branch.closing_time),
  )
  const [isAccepting, setIsAccepting] = useState(branch.is_accepting_orders)
  const [isActive, setIsActive] = useState(branch.is_active)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSuccess(false)
    setSubmitting(true)
    const r = await updateRestaurantBranch(restaurantId, branch.id, {
      opening_time: openingTime || null,
      closing_time: closingTime || null,
      is_accepting_orders: isAccepting,
      is_active: isActive,
    })
    setSubmitting(false)
    if (r.ok) {
      setSuccess(true)
      startTransition(() => router.refresh())
    } else {
      setError(r.error)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm font-medium text-zinc-900">{branch.name}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            Opening time
          </label>
          <input
            type="time"
            value={openingTime}
            onChange={(e) => setOpeningTime(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            Closing time
          </label>
          <input
            type="time"
            value={closingTime}
            onChange={(e) => setClosingTime(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={isAccepting}
            onChange={(e) => setIsAccepting(e.target.checked)}
            className="h-4 w-4"
          />
          Accepting orders
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          Active
        </label>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md bg-green-50 p-2 text-sm text-green-700">
          Saved.
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save branch'}
        </button>
      </div>
    </form>
  )
}
