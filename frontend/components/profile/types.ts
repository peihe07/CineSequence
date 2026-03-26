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
  sequencing_status: string
  archetype_id: string | null
  archetype_name: string | null
  personality_reading: string | null
  ticket_style: string | null
  personal_ticket_url: string | null
}
