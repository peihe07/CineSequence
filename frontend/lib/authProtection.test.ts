import { describe, expect, it } from 'vitest'

import { buildLoginRedirect, requiresAuth, sanitizeNextPath } from './authProtection'

describe('auth protection helpers', () => {
  it('marks protected routes correctly', () => {
    expect(requiresAuth('/profile')).toBe(true)
    expect(requiresAuth('/notifications')).toBe(true)
    expect(requiresAuth('/sequencing/seed')).toBe(true)
    expect(requiresAuth('/sequencing/complete')).toBe(true)
    expect(requiresAuth('/theaters/123')).toBe(false)
    expect(requiresAuth('/dna')).toBe(false)
    expect(requiresAuth('/login')).toBe(false)
    expect(requiresAuth('/')).toBe(false)
  })

  it('sanitizes post-auth redirect targets', () => {
    expect(sanitizeNextPath('/profile')).toBe('/profile')
    expect(sanitizeNextPath('/profile?tab=bio')).toBe('/profile?tab=bio')
    expect(sanitizeNextPath('https://evil.example')).toBeNull()
    expect(sanitizeNextPath('//evil.example')).toBeNull()
  })

  it('builds a login redirect with the original path encoded', () => {
    expect(buildLoginRedirect('/profile', '?tab=bio')).toBe('/login?next=%2Fprofile%3Ftab%3Dbio')
  })
})
