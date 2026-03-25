import { describe, expect, it } from 'vitest'

import { buildApiUrl, resolveApiUrl } from './api-origin'

describe('api origin helpers', () => {
  it('defaults to the same-origin api path in the browser', () => {
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          hostname: 'app.cinesequence.xyz',
          protocol: 'https:',
        },
      },
      configurable: true,
    })

    expect(resolveApiUrl({}, true)).toBe('/api')

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    })
  })

  it('uses the local backend directly in browser localhost development', () => {
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          hostname: 'localhost',
          protocol: 'http:',
        },
      },
      configurable: true,
    })

    expect(resolveApiUrl({}, true)).toBe('http://localhost:8000')

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    })
  })

  it('prefers an explicit public api url when configured', () => {
    expect(resolveApiUrl({ NEXT_PUBLIC_API_URL: 'https://api.cinesequence.xyz/' }, true)).toBe(
      'https://api.cinesequence.xyz',
    )
  })

  it('keeps the browser loopback host when the explicit api url points at a different loopback hostname', () => {
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          hostname: '127.0.0.1',
          protocol: 'http:',
        },
      },
      configurable: true,
    })

    expect(resolveApiUrl({ NEXT_PUBLIC_API_URL: 'http://localhost:8000' }, true)).toBe(
      'http://127.0.0.1:8000',
    )

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    })
  })

  it('keeps the browser loopback host for explicit api urls that use localhost while browsing on localhost', () => {
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          hostname: 'localhost',
          protocol: 'http:',
        },
      },
      configurable: true,
    })

    expect(resolveApiUrl({ NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8000' }, true)).toBe(
      'http://localhost:8000',
    )

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    })
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
