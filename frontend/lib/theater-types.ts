export interface TheaterUserSummary {
  id: string
  name: string
  avatar_url: string | null
}

export interface TheaterMovie {
  tmdb_id: number
  title_en: string
  match_tags: string[]
}

export interface TheaterWatchlistMovie extends TheaterMovie {
  supporter_count: number
}

export interface TheaterMessage {
  id: string
  body: string
  created_at: string
  can_delete: boolean
  user: TheaterUserSummary
}

export interface TheaterActivity {
  id: string
  type: 'list_created' | 'list_replied'
  created_at: string
  actor: TheaterUserSummary
  list_id: string
  list_title: string
  body: string | null
}

export interface TheaterGroup {
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
  member_preview: TheaterUserSummary[]
  recommended_movies: TheaterMovie[]
  shared_watchlist: TheaterWatchlistMovie[]
  recent_messages: TheaterMessage[]
  recent_activity: TheaterActivity[]
}

export interface TheaterListItem {
  id: string
  tmdb_id: number
  title_en: string
  title_zh: string | null
  poster_url: string | null
  genres: string[]
  runtime_minutes: number | null
  match_tags: string[]
  note: string | null
  position: number
}

export interface TheaterMovieSearchResult {
  tmdb_id: number
  title_en: string
  title_zh: string | null
  poster_url: string | null
  year: number | null
  genres: string[]
  runtime_minutes: number | null
}

export interface TheaterListReply {
  id: string
  body: string
  created_at: string
  can_delete: boolean
  user: TheaterUserSummary
}

export interface TheaterList {
  id: string
  group_id: string
  title: string
  description: string | null
  visibility: string
  created_at: string
  updated_at: string
  creator: TheaterUserSummary
  items: TheaterListItem[]
  replies: TheaterListReply[]
}
