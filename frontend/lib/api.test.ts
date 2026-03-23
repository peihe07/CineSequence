import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api, apiUpload } from './api'

describe('api helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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
})
