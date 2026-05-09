'use client'

import { useActionState } from 'react'
import { updateRestaurant, type UpdateRestaurantState } from './actions'

const inputCls =
  'rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none'
const labelCls = 'text-sm font-medium text-zinc-700'

export type EditableRestaurant = {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  plan_type: string
  is_active: boolean
}

const PLAN_OPTIONS = ['free', 'starter', 'pro', 'enterprise'] as const

export function RestaurantEditForm({
  restaurant,
}: {
  restaurant: EditableRestaurant
}) {
  const [state, action, pending] = useActionState<
    UpdateRestaurantState | undefined,
    FormData
  >(updateRestaurant, undefined)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={restaurant.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className={labelCls}>
            Name <span className="text-red-600">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={restaurant.name}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="slug" className={labelCls}>
            Slug <span className="text-red-600">*</span>
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            defaultValue={restaurant.slug}
            placeholder="e.g. crispy-bites"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className={labelCls}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={restaurant.email ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className={labelCls}>
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="text"
            defaultValue={restaurant.phone ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="plan_type" className={labelCls}>
            Plan type
          </label>
          <select
            id="plan_type"
            name="plan_type"
            defaultValue={restaurant.plan_type}
            className={inputCls}
          >
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-6">
          <input
            id="is_active"
            name="is_active"
            type="checkbox"
            defaultChecked={restaurant.is_active}
            className="h-4 w-4 rounded border-zinc-300"
          />
          <label htmlFor="is_active" className={labelCls}>
            Active
          </label>
        </div>
      </div>

      {state?.error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      ) : null}
      {state?.success ? (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          Saved.
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

export function QuickStatusForm({
  restaurant,
}: {
  restaurant: EditableRestaurant
}) {
  const [state, action, pending] = useActionState<
    UpdateRestaurantState | undefined,
    FormData
  >(updateRestaurant, undefined)

  const nextActive = !restaurant.is_active

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={restaurant.id} />
      <input type="hidden" name="name" value={restaurant.name} />
      <input type="hidden" name="slug" value={restaurant.slug} />
      <input type="hidden" name="email" value={restaurant.email ?? ''} />
      <input type="hidden" name="phone" value={restaurant.phone ?? ''} />
      <input type="hidden" name="plan_type" value={restaurant.plan_type} />
      {nextActive ? (
        <input type="hidden" name="is_active" value="on" />
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={
          nextActive
            ? 'rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60'
            : 'rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60'
        }
      >
        {pending
          ? 'Working…'
          : nextActive
            ? 'Activate restaurant'
            : 'Suspend restaurant'}
      </button>
      {state?.error ? (
        <p className="text-xs text-red-700">{state.error}</p>
      ) : null}
    </form>
  )
}
