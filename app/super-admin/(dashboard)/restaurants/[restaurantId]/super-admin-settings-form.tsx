'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateRestaurantSettings } from './settings-actions'

export type SuperAdminSettings = {
  logo_url: string | null
  banner_url: string | null
  primary_color: string | null
  secondary_color: string | null
  whatsapp_number: string | null
  instagram_url: string | null
  facebook_url: string | null
  minimum_order_amount: number
  is_accepting_orders: boolean
}

export default function SuperAdminSettingsForm({
  restaurantId,
  restaurantSlug,
  settings,
}: {
  restaurantId: string
  restaurantSlug: string
  settings: SuperAdminSettings
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? '')
  const [bannerUrl, setBannerUrl] = useState(settings.banner_url ?? '')
  const [primaryColor, setPrimaryColor] = useState(
    settings.primary_color ?? '',
  )
  const [secondaryColor, setSecondaryColor] = useState(
    settings.secondary_color ?? '',
  )
  const [whatsappNumber, setWhatsappNumber] = useState(
    settings.whatsapp_number ?? '',
  )
  const [instagramUrl, setInstagramUrl] = useState(
    settings.instagram_url ?? '',
  )
  const [facebookUrl, setFacebookUrl] = useState(settings.facebook_url ?? '')
  const [minimumOrder, setMinimumOrder] = useState(
    String(settings.minimum_order_amount ?? 0),
  )
  const [isAccepting, setIsAccepting] = useState(settings.is_accepting_orders)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSuccess(false)
    setSubmitting(true)
    const r = await updateRestaurantSettings(restaurantId, {
      logo_url: logoUrl,
      banner_url: bannerUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      whatsapp_number: whatsappNumber,
      instagram_url: instagramUrl,
      facebook_url: facebookUrl,
      minimum_order_amount: Number(minimumOrder) || 0,
      is_accepting_orders: isAccepting,
    })
    setSubmitting(false)
    if (r.ok) {
      setSuccess(true)
      startTransition(() => router.refresh())
    } else {
      setError(r.error)
    }
  }

  void restaurantSlug

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={isAccepting}
          onChange={(e) => setIsAccepting(e.target.checked)}
          className="h-4 w-4"
        />
        Accepting orders
      </label>

      <div>
        <label className="block text-xs font-medium text-zinc-700">
          Minimum order amount (PKR)
        </label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={minimumOrder}
          onChange={(e) => setMinimumOrder(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            Logo URL <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            Banner URL <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            Primary color
          </label>
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#000000"
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            Secondary color
          </label>
          <input
            type="text"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            placeholder="#ffffff"
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            WhatsApp number <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            Instagram URL <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-700">
            Facebook URL <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md bg-green-50 p-2 text-sm text-green-700">
          Settings saved.
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  )
}
