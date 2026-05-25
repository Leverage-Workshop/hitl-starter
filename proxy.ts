import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/config', '/settings']

/**
 * Auth guard — replaces the former hitl_authed cookie check with real
 * Better Auth session verification via auth.api.getSession().
 */
export async function proxy(request: NextRequest) {
  const isProtected = PROTECTED.some(p =>
    request.nextUrl.pathname.startsWith(p)
  )
  if (!isProtected) return

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/config/:path*', '/settings/:path*'],
}
