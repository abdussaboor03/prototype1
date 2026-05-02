'use client'

import { useActionState } from 'react'
import { createRestaurant, type CreateRestaurantState } from './actions'

const inputCls =
  'rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none'
const labelCls = 'text-sm font-medium text-zinc-700'

function Field({
  name,
  label,
  type = 'text',
  required,
  defaultValue,
  placeholder,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  defaultValue?: string
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className={labelCls}>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
      <legend className="px-1 text-sm font-semibold text-zinc-800">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

export function NewRestaurantForm() {
  const [state, action, pending] = useActionState<
    CreateRestaurantState,
    FormData
  >(createRestaurant, undefined)

  return (
    <form action={action} className="space-y-6">
      <Section title="Restaurant">
        <Field name="name" label="Name" required />
        <Field
          name="slug"
          label="Slug"
          required
          placeholder="e.g. crispy-bites"
        />
        <Field name="email" label="Email" type="email" />
        <Field name="phone" label="Phone" />
        <div className="flex flex-col gap-1">
          <label htmlFor="plan_type" className={labelCls}>
            Plan type
          </label>
          <select
            id="plan_type"
            name="plan_type"
            defaultValue="free"
            className={inputCls}
          >
            <option value="free">free</option>
            <option value="starter">starter</option>
            <option value="pro">pro</option>
            <option value="enterprise">enterprise</option>
          </select>
        </div>
      </Section>

      <Section title="First branch">
        <Field name="branch_name" label="Branch name" required />
        <Field
          name="branch_slug"
          label="Branch slug"
          required
          placeholder="e.g. dha-phase-5"
        />
        <Field name="branch_address" label="Address" />
        <Field name="branch_phone" label="Phone" />
        <Field name="opening_time" label="Opening time" type="time" />
        <Field name="closing_time" label="Closing time" type="time" />
      </Section>

      <Section title="Branding & settings">
        <Field name="logo_url" label="Logo URL" type="url" />
        <Field name="banner_url" label="Banner URL" type="url" />
        <div className="flex flex-col gap-1">
          <label htmlFor="primary_color" className={labelCls}>
            Primary colour
          </label>
          <input
            id="primary_color"
            name="primary_color"
            type="color"
            defaultValue="#000000"
            className="h-10 w-20 rounded-md border border-zinc-300"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="secondary_color" className={labelCls}>
            Secondary colour
          </label>
          <input
            id="secondary_color"
            name="secondary_color"
            type="color"
            defaultValue="#ffffff"
            className="h-10 w-20 rounded-md border border-zinc-300"
          />
        </div>
        <Field name="whatsapp_number" label="WhatsApp number" />
        <Field
          name="minimum_order_amount"
          label="Minimum order amount (PKR)"
          type="number"
          defaultValue="0"
        />
      </Section>

      {state?.error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Creating…' : 'Create restaurant'}
        </button>
      </div>
    </form>
  )
}
