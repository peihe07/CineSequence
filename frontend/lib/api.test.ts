import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTH_UNAUTHORIZED_EVENT, ApiError, api, apiUpload } from './api'

describe('api helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('returns undefined for 204 responses', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: vi.fn(),
      text: vi.fn(),
    } as unknown as Response)

    const result = await api('/auth/logout', { method: 'POST' })

    expect(result).toBeUndefined()
  })

  it('returns undefined for empty successful responses', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn(),
      text: vi.fn().mockResolvedValue(''),
    } as unknown as Response)

    const result = await api('/empty')

    expect(result).toBeUndefined()
  })

  it('parses json for successful json responses', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ ok: true }),
      text: vi.fn().mockResolvedValue('{"ok":true}'),
    } as unknown as Response)

    const result = await api<{ ok: boolean }>('/health')

    expect(result).toEqual({ ok: true })
  })

  it('does not inject a bearer token header from localStorage', async () => {
    window.localStorage.setItem('cine_sequence_access_token', 'jwt-token')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: vi.fn().mockResolvedValue('{"ok":true}'),
    } as unknown as Response)

    await api('/profile')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/profile'),
      expect.objectContaining({
        credentials: 'include',
        headers: {},
      }),
    )
  })

  it('throws ApiError with fallback detail on failed uploads', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('bad body')),
    } as unknown as Response)

    await expect(
      apiUpload('/upload', new File(['x'], 'x.txt')),
    ).rejects.toEqual(new ApiError(500, 'Upload failed'))
  })

  it('clears the stored token and emits an event on unauthorized responses', async () => {
    const listener = vi.fn()
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener)
    window.localStorage.setItem('cine_sequence_access_token', 'jwt-token')

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ detail: 'Unauthorized' }),
    } as unknown as Response)

    await expect(api('/profile')).rejects.toEqual(new ApiError(401, 'Unauthorized'))
    expect(window.localStorage.getItem('cine_sequence_access_token')).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
