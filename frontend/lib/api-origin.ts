const DEFAULT_BROWSER_API_BASE = '/api'
const DEFAULT_SERVER_API_BASE = 'http://127.0.0.1:8000'
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1'])

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') && value !== '/' ? value.replace(/\/+$/, '') : value
}

export function resolveApiUrl(
  env: Partial<Record<string, string | undefined>> = process.env,
  hasWindow = typeof window !== 'undefined',
): string {
  const explicit = env.NEXT_PUBLIC_API_URL?.trim()
  if (explicit) {
    return trimTrailingSlash(explicit)
  }

  if (hasWindow) {
    const hostname = window.location.hostname
    const protocol = window.location.protocol || 'http:'

    if (LOCAL_HOSTNAMES.has(hostname)) {
      return `${protocol}//${hostname}:8000`
    }

    return DEFAULT_BROWSER_API_BASE
  }

  const proxyTarget = env.API_PROXY_TARGET?.trim()
  if (proxyTarget) {
    return trimTrailingSlash(proxyTarget)
  }

  return DEFAULT_SERVER_API_BASE
}

export function buildApiUrl(base: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const normalizedBase = trimTrailingSlash(base)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (normalizedBase === '/') {
    return normalizedPath
  }

  return `${normalizedBase}${normalizedPath}`
}
