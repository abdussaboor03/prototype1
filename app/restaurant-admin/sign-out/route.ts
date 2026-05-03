import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Route handler signOut — used by the DAL to break out of an
// invalid session (RSCs cannot clear cookies). Route handlers can.
export async function GET(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get('reason')
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()

  const target = reason
    ? `/restaurant-admin/login?error=${encodeURIComponent(reason)}`
    : '/restaurant-admin/login'

  return NextResponse.redirect(new URL(target, request.url))
}
