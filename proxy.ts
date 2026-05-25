import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/config', '/settings']

export function proxy(request: NextRequest) {
  const authed = request.cookies.get('hitl_authed')?.value === 'true'
  const isProtected = PROTECTED.some(p => request.nextUrl.pathname.startsWith(p))

  if (isProtected && !authed) {
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/config/:path*', '/settings/:path*'],
}
