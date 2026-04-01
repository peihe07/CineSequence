const PROTECTED_PREFIXES = [
  '/admin',
  '/notifications',
  '/profile',
  '/sequencing/complete',
  '/sequencing/seed',
]

export function requiresAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function sanitizeNextPath(nextPath: string | null | undefined): string | null {
  if (!nextPath) {
    return null
  }

  const trimmed = nextPath.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null
  }

  return trimmed
}

export function buildLoginRedirect(pathname: string, search = ''): string {
  const nextPath = sanitizeNextPath(`${pathname}${search}`)
  if (!nextPath) {
    return '/login'
  }

  return `/login?next=${encodeURIComponent(nextPath)}`
}
