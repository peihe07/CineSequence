import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { buildLoginRedirect, requiresAuth } from '@/lib/authProtection'

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'cine_sequence_session'

export function middleware(request: NextRequest) {
  const { nextUrl, cookies } = request

  if (!requiresAuth(nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (cookies.get(AUTH_COOKIE_NAME)?.value) {
    return NextResponse.next()
  }

  const loginUrl = new URL(buildLoginRedirect(nextUrl.pathname, nextUrl.search), nextUrl.origin)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dna/:path*',
    '/matches/:path*',
    '/profile/:path*',
    '/sequencing/:path*',
    '/theaters/:path*',
    '/ticket/:path*',
  ],
}
