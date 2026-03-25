export interface User {
  id: string
  email: string
  name: string
  gender: string
  region: string
  avatar_url: string | null
  sequencing_status: string
  is_admin: boolean
}

export interface RegisterRequest {
  email: string
  name: string
  gender: string
  region: string
  birth_year?: number
  agreed_to_terms: boolean
  next_path?: string
}

export interface LoginRequest {
  email: string
  next_path?: string
}

export interface RegisterResponse {
  message: string
}

export interface VerifyRequest {
  token: string
}

export interface VerifyResponse {
  access_token: string
  token_type: string
}
