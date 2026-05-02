import { LoginForm } from './login-form'

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized: 'This account does not have super admin access.',
}

export default async function SuperAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const initialError = error ? ERROR_MESSAGES[error] : undefined

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Super admin</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Sign in to manage the platform.
        </p>
        <div className="mt-6">
          <LoginForm initialError={initialError} />
        </div>
      </div>
    </div>
  )
}
