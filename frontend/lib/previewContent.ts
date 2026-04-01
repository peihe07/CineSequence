import type { Profile } from '@/components/profile/types'
import type { TheaterGroup, TheaterList } from '@/lib/theater-types'
import type { DnaResult } from '@/stores/dnaStore'
import type { MatchItem } from '@/stores/matchStore'
import type { Pair, Progress } from '@/stores/sequencingStore'

export const PREVIEW_SEQUENCING_PROGRESS: Progress = {
  round_number: 12,
  phase: 2,
  total_rounds: 30,
  completed: false,
  seed_movie_tmdb_id: 603,
  can_extend: true,
  extension_batches: 0,
  max_extension_batches: 2,
  session_version: 1,
  is_extending: false,
}

export const PREVIEW_SEQUENCING_PAIR: Pair = {
  round_number: 12,
  phase: 2,
  completed: false,
  test_dimension: 'melancholic_intimacy',
  movie_a: {
    tmdb_id: 19404,
    title_en: 'Dil Se..',
    title_zh: '真心愛著你',
    poster_url: null,
    year: 1998,
    genres: ['Romance', 'Drama'],
    overview: 'A feverish romance that keeps tenderness and danger in the same frame.',
  },
  movie_b: {
    tmdb_id: 11216,
    title_en: 'Cinema Paradiso',
    title_zh: '新天堂樂園',
    poster_url: null,
    year: 1988,
    genres: ['Drama'],
    overview: 'A memory-soaked love letter to moviegoing, hometown longing, and time.',
  },
}

export const PREVIEW_DNA_RESULT: DnaResult = {
  archetype: {
    id: 'midnight-cartographer',
    name: '午夜地圖師',
    name_en: 'Midnight Cartographer',
    icon: 'ri-compass-3-line',
    description: '你偏好會在情緒與結構之間留下餘韻的電影，喜歡慢慢顯影的暗流。',
  },
  tag_vector: [],
  tag_labels: {
    dreamlike: 0.88,
    slowburn: 0.83,
    melancholic: 0.79,
    sensual: 0.72,
    atmospheric: 0.69,
    intimate: 0.62,
  },
  top_tags: ['dreamlike', 'slowburn', 'melancholic', 'sensual'],
  supporting_signals: [
    { tag: 'dreamlike', score: 0.88, confidence: 0.93, consistency: 0.82 },
    { tag: 'slowburn', score: 0.83, confidence: 0.9, consistency: 0.8 },
    { tag: 'melancholic', score: 0.79, confidence: 0.84, consistency: 0.76 },
  ],
  avoided_signals: [
    { tag: 'broad-comedy', score: 0.12, confidence: 0.67, consistency: 0.61 },
  ],
  mixed_signals: [
    { tag: 'mindfuck', score: 0.46, confidence: 0.58, consistency: 0.43 },
  ],
  comparison_evidence: [
    {
      round: 7,
      chosen_title: 'In the Mood for Love',
      rejected_title: 'The Grand Budapest Hotel',
      dimension: 'intimacy_vs_whimsy',
      focus_tags: ['intimate', 'restrained'],
      chosen_tags: ['intimate', 'melancholic'],
      rejected_tags: ['whimsical', 'ornate'],
    },
    {
      round: 11,
      chosen_title: 'Burning',
      rejected_title: 'Whiplash',
      dimension: 'slowburn_vs_intensity',
      focus_tags: ['slowburn', 'suspense'],
      chosen_tags: ['slowburn', 'ambiguous'],
      rejected_tags: ['kinetic', 'aggressive'],
    },
  ],
  interaction_diagnostics: {
    skip_count: 3,
    dislike_both_count: 1,
    explicit_pick_count: 18,
  },
  genre_vector: {
    Drama: 0.94,
    Romance: 0.71,
    Mystery: 0.64,
    Thriller: 0.43,
  },
  quadrant_scores: {
    mainstream_independent: 0.74,
    rational_emotional: 0.67,
    light_dark: 0.81,
  },
  personality_reading:
    '你不追求單純的情節效率，而是會被情緒如何滲進畫面、空間與沉默所吸引。你對電影的投入常常來自那些無法被一句話概括的曖昧餘震。',
  hidden_traits: ['對含蓄的情感表達很敏感', '偏好延遲揭露而非立即宣告'],
  conversation_style: '適合從一個細節、一句台詞或一個遺憾的選擇開始對話。',
  ideal_movie_date: '先一起看完片，散場後在街角慢慢拆解彼此最在意的那一幕。',
  ticket_style: 'velvet-noir',
  can_extend: true,
}

export const PREVIEW_MATCHES: MatchItem[] = [
  {
    id: 'preview-match-1',
    partner_id: 'preview-user-1',
    partner_name: 'Aster',
    partner_email: 'aster@example.com',
    partner_bio: '偏愛會在散場後慢慢發酵的電影，也收藏很多城市夜景片單。',
    partner_avatar_url: null,
    partner_archetype: 'Night Signalist',
    similarity_score: 0.91,
    candidate_percentile: 94,
    candidate_pool_size: 41,
    shared_tags: ['dreamlike', 'melancholic', 'slowburn'],
    ice_breakers: ['你會把哪一部片留到最後才推薦給別人？'],
    status: 'accepted',
    ticket_image_url: '/og-image.png',
    is_recipient: false,
  },
  {
    id: 'preview-match-2',
    partner_id: 'preview-user-2',
    partner_name: 'Mika',
    partner_email: null,
    partner_bio: '對聲音設計和雨夜場景有執念，喜歡情緒先於答案的電影。',
    partner_avatar_url: null,
    partner_archetype: 'Echo Archivist',
    similarity_score: 0.84,
    candidate_percentile: 88,
    candidate_pool_size: 41,
    shared_tags: ['atmospheric', 'intimate'],
    ice_breakers: ['最近一次讓你整晚睡不著的片尾是什麼？'],
    status: 'discovered',
    ticket_image_url: null,
    is_recipient: false,
  },
]

export const PREVIEW_TICKET_MATCH: MatchItem = PREVIEW_MATCHES[0]

export const PREVIEW_THEATER_GROUPS: TheaterGroup[] = [
  {
    id: 'midnight-echo',
    name: 'Midnight Echo',
    subtitle: '霓虹、潮濕街景、靜默情緒',
    icon: 'ri-moon-foggy-line',
    primary_tags: ['dreamlike', 'melancholic', 'atmospheric'],
    is_hidden: false,
    member_count: 28,
    is_active: true,
    is_member: true,
    shared_tags: ['dreamlike', 'melancholic'],
    member_preview: [
      { id: 'u-aster', name: 'Aster', avatar_url: null },
      { id: 'u-jo', name: 'Jo', avatar_url: null },
      { id: 'u-rin', name: 'Rin', avatar_url: null },
    ],
    recommended_movies: [
      { tmdb_id: 843, title_en: 'In the Mood for Love', poster_url: null, match_tags: ['intimate', 'melancholic'] },
      { tmdb_id: 398818, title_en: 'Call Me by Your Name', poster_url: null, match_tags: ['sensual', 'summer'] },
    ],
    shared_watchlist: [
      { tmdb_id: 491584, title_en: 'Burning', poster_url: null, match_tags: ['slowburn', 'ambiguous'], supporter_count: 12 },
      { tmdb_id: 10376, title_en: 'The Worst Person in the World', poster_url: null, match_tags: ['restless', 'intimate'], supporter_count: 9 },
    ],
    recent_messages: [
      {
        id: 'msg-1',
        body: '這個房間最近都在推遲揭露型的故事，Burning 應該值得再開一次票。',
        created_at: '2026-03-29T13:20:00Z',
        can_delete: false,
        user: { id: 'u-aster', name: 'Aster', avatar_url: null },
      },
    ],
    recent_activity: [
      {
        id: 'act-1',
        type: 'list_created',
        created_at: '2026-03-29T10:00:00Z',
        actor: { id: 'u-jo', name: 'Jo', avatar_url: null },
        list_id: 'list-1',
        list_title: 'After Midnight Rewatch Queue',
        body: null,
      },
      {
        id: 'act-2',
        type: 'list_replied',
        created_at: '2026-03-29T11:15:00Z',
        actor: { id: 'u-rin', name: 'Rin', avatar_url: null },
        list_id: 'list-1',
        list_title: 'After Midnight Rewatch Queue',
        body: '先從最慢熱的開始，才能看出這個房間的脾氣。',
      },
    ],
  },
  {
    id: 'glass-corridor',
    name: 'Glass Corridor',
    subtitle: '理性冷光、懸疑結構、失真記憶',
    icon: 'ri-ghost-2-line',
    primary_tags: ['mindfuck', 'precision'],
    is_hidden: false,
    member_count: 17,
    is_active: true,
    is_member: false,
    shared_tags: ['mindfuck'],
    member_preview: [
      { id: 'u-min', name: 'Min', avatar_url: null },
      { id: 'u-sol', name: 'Sol', avatar_url: null },
    ],
    recommended_movies: [
      { tmdb_id: 77, title_en: 'Memento', poster_url: null, match_tags: ['fractured', 'memory'] },
    ],
    shared_watchlist: [],
    recent_messages: [],
    recent_activity: [],
  },
]

export const PREVIEW_THEATER_LISTS: TheaterList[] = [
  {
    id: 'list-1',
    group_id: 'midnight-echo',
    title: 'After Midnight Rewatch Queue',
    description: '適合夜深後連播，留給還不想太快散場的人。',
    visibility: 'group',
    created_at: '2026-03-28T17:00:00Z',
    updated_at: '2026-03-29T11:15:00Z',
    creator: { id: 'u-jo', name: 'Jo', avatar_url: null },
    items: [
      {
        id: 'item-1',
        tmdb_id: 491584,
        title_en: 'Burning',
        title_zh: '燃燒烈愛',
        poster_url: null,
        genres: ['Drama', 'Mystery'],
        runtime_minutes: 148,
        match_tags: ['slowburn', 'ambiguous'],
        note: '第一部先把房間節奏定下來。',
        position: 0,
      },
      {
        id: 'item-2',
        tmdb_id: 843,
        title_en: 'In the Mood for Love',
        title_zh: '花樣年華',
        poster_url: null,
        genres: ['Drama', 'Romance'],
        runtime_minutes: 99,
        match_tags: ['intimate', 'melancholic'],
        note: '接著換成更貼近呼吸的情緒。',
        position: 1,
      },
    ],
    replies: [
      {
        id: 'reply-1',
        body: '如果要帶新成員進來，第二部也可以換成 Aftersun。',
        created_at: '2026-03-29T11:15:00Z',
        can_delete: false,
        user: { id: 'u-rin', name: 'Rin', avatar_url: null },
      },
    ],
  },
]

export const PREVIEW_PROFILE: Profile = {
  id: 'preview-profile',
  email: 'preview@cinesequence.xyz',
  name: 'Preview Reader',
  bio: '偏愛會在散場後留下回音的片單。',
  avatar_url: null,
  gender: 'prefer_not_to_say',
  birth_year: 1994,
  region: 'Taipei',
  match_gender_pref: null,
  match_age_min: null,
  match_age_max: null,
  pure_taste_match: true,
  match_threshold: 0.78,
  is_visible: true,
  email_notifications_enabled: true,
  sequencing_status: 'completed',
  is_admin: false,
  archetype_id: 'midnight-cartographer',
  archetype_name: 'Midnight Cartographer',
  personality_reading: PREVIEW_DNA_RESULT.personality_reading,
  ticket_style: PREVIEW_DNA_RESULT.ticket_style,
  personal_ticket_url: '/og-image.png',
  favorite_movies: [
    {
      id: 'fav-1',
      tmdb_id: 843,
      title_zh: '花樣年華',
      title_en: 'In the Mood for Love',
      poster_url: null,
      display_order: 0,
    },
    {
      id: 'fav-2',
      tmdb_id: 491584,
      title_zh: '燃燒烈愛',
      title_en: 'Burning',
      poster_url: null,
      display_order: 1,
    },
  ],
}
