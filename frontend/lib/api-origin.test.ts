import { describe, expect, it } from 'vitest'

import { buildApiUrl, resolveApiUrl } from './api-origin'

describe('api origin helpers', () => {
  it('defaults to the same-origin api path in the browser', () => {
    expect(resolveApiUrl({}, true)).toBe('/api')
  })

  it('prefers an explicit public api url when configured', () => {
    expect(resolveApiUrl({ NEXT_PUBLIC_API_URL: 'https://api.cinesequence.xyz/' }, true)).toBe(
      'https://api.cinesequence.xyz',
    )
  })

  it('uses the proxy target during server-side execution when available', () => {
    expect(resolveApiUrl({ API_PROXY_TARGET: 'https://api.cinesequence.xyz/' }, false)).toBe(
      'https://api.cinesequence.xyz',
    )
  })

  it('falls back to the local backend in server-side contexts', () => {
    expect(resolveApiUrl({}, false)).toBe('http://127.0.0.1:8000')
  })

  it('joins the base and path without duplicating slashes', () => {
    expect(buildApiUrl('/api', '/profile')).toBe('/api/profile')
    expect(buildApiUrl('https://api.cinesequence.xyz/', 'profile')).toBe(
      'https://api.cinesequence.xyz/profile',
    )
  })
})
