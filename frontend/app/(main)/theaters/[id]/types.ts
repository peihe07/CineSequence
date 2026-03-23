export interface TheaterMessage {
  id: string
  body: string
  created_at: string
  can_delete: boolean
  user: {
    id: string
    name: string
    avatar_url: string | null
  }
}

export interface TheaterGroupDetail {
  id: string
  name: string
  subtitle: string
  icon: string
  primary_tags: string[]
  is_hidden: boolean
  member_count: number
  is_active: boolean
  is_member: boolean
  shared_tags: string[]
  member_preview: Array<{
    id: string
    name: string
    avatar_url: string | null
  }>
  recommended_movies: Array<{
    tmdb_id: number
    title_en: string
    match_tags: string[]
  }>
  shared_watchlist: Array<{
    tmdb_id: number
    title_en: string
    match_tags: string[]
    supporter_count: number
  }>
  recent_messages: TheaterMessage[]
}
