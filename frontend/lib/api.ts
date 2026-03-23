function resolveApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000`
  }

  return 'http://127.0.0.1:8000'
}

const API_URL = resolveApiUrl()

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
  return null
}

export function setToken(token: string): void {
  void token
}

export function clearToken(): void {
  return
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Request failed' }))
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
  const formData = new FormData()
  formData.append(fieldName, file)

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new ApiError(response.status, body.detail || 'Upload failed')
  }

  return parseSuccessBody<T>(response)
}
