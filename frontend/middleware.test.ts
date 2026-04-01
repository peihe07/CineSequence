import { describe, expect, it } from 'vitest'

import { middleware } from './middleware'

describe('middleware', () => {
  it('redirects unauthenticated protected requests to login with a next param', () => {
    const response = middleware({
      nextUrl: new URL('https://cinesequence.xyz/profile?tab=bio'),
      cookies: {
        get: () => undefined,
      },
    } as never)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://cinesequence.xyz/login?next=%2Fprofile%3Ftab%3Dbio',
    )
  })

  it('allows protected requests when the session cookie exists', () => {
    const response = middleware({
      nextUrl: new URL('https://cinesequence.xyz/profile'),
      cookies: {
        get: () => ({ value: 'session-token' }),
      },
    } as never)

    expect(response.headers.get('location')).toBeNull()
  })

  it('allows previewable requests without a session cookie', () => {
    const response = middleware({
      nextUrl: new URL('https://cinesequence.xyz/dna'),
      cookies: {
        get: () => undefined,
      },
    } as never)

    expect(response.headers.get('location')).toBeNull()
  })
})
