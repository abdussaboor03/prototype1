export default function RestaurantNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Restaurant not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        We couldn’t find a restaurant at this URL. It may be inactive or the
        link may be incorrect.
      </p>
    </div>
  )
}
