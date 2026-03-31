export interface FavoriteMovie {
  id: string
  tmdb_id: number
  title_zh: string | null
  title_en: string | null
  poster_url: string | null
  display_order: number
}

export interface Profile {
  id: string
  email: string
  name: string
  bio: string | null
  avatar_url: string | null
  gender: string
  birth_year: number | null
  region: string
  match_gender_pref: string | null
  match_age_min: number | null
  match_age_max: number | null
  pure_taste_match: boolean
  match_threshold: number
  is_visible: boolean
  email_notifications_enabled: boolean
  sequencing_status: string
  is_admin: boolean
  archetype_id: string | null
  archetype_name: string | null
  personality_reading: string | null
  ticket_style: string | null
  personal_ticket_url: string | null
  favorite_movies: FavoriteMovie[]
}
