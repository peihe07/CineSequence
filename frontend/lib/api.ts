const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

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

  return response.json()
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

  return response.json()
}
