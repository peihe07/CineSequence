import { buildApiUrl, resolveApiUrl } from './api-origin'
import { logPerf } from './perf'

const TOKEN_STORAGE_KEY = 'cine_sequence_access_token'
export const AUTH_UNAUTHORIZED_EVENT = 'cine-sequence:auth-unauthorized'

const API_URL = resolveApiUrl()

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

async function parseSuccessBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }

  const raw = await response.text()
  if (!raw.trim()) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return JSON.parse(raw) as T
  }

  return raw as T
}

export function getToken(): string | null {
  if (!canUseStorage()) {
    return null
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setToken(token: string): void {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearToken(): void {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}

function notifyUnauthorized(): void {
  if (typeof window === 'undefined') {
    return
  }

  clearToken()
  window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT))
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  }
  const hasBody = options.body !== undefined && options.body !== null

  if (!('Content-Type' in headers) && hasBody && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(buildApiUrl(API_URL, path), {
    ...options,
    headers,
    credentials: 'include',
  })
  const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
  logPerf(`api ${options.method ?? 'GET'} ${path}`, durationMs, { status: response.status })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Request failed' }))
    if (response.status === 401 || response.status === 403) {
      notifyUnauthorized()
    }
    throw new ApiError(response.status, body.detail || 'Request failed')
  }

  return parseSuccessBody<T>(response)
}

/**
 * Upload a file via multipart/form-data (no Content-Type header — browser sets boundary).
 */
export async function apiUpload<T>(
  path: string,
  file: File,
  fieldName = 'file',
): Promise<T> {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const formData = new FormData()
  formData.append(fieldName, file)

  const response = await fetch(buildApiUrl(API_URL, path), {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })
  const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
  logPerf(`apiUpload POST ${path}`, durationMs, { status: response.status })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Upload failed' }))
    if (response.status === 401 || response.status === 403) {
      notifyUnauthorized()
    }
    throw new ApiError(response.status, body.detail || 'Upload failed')
  }

  return parseSuccessBody<T>(response)
}
