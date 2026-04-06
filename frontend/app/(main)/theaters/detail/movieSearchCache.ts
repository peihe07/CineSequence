'use client'

import { api } from '@/lib/api'
import type { TheaterMovieSearchResult } from '@/lib/theater-types'

const movieSearchCache = new Map<string, { fetchedAt: number; results: TheaterMovieSearchResult[] }>()
const movieSearchInflight = new Map<string, Promise<TheaterMovieSearchResult[]>>()
const MOVIE_SEARCH_CACHE_TTL_MS = 30_000

export function __resetTheaterDetailSearchCacheForTests(): void {
  movieSearchCache.clear()
  movieSearchInflight.clear()
}

export async function searchTheaterMovies(query: string): Promise<TheaterMovieSearchResult[]> {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2) {
    return []
  }

  const cacheKey = normalizedQuery.toLowerCase()
  const cached = movieSearchCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < MOVIE_SEARCH_CACHE_TTL_MS) {
    return cached.results
  }

  const inflight = movieSearchInflight.get(cacheKey)
  if (inflight) {
    return inflight
  }

  const request = api<TheaterMovieSearchResult[]>(
    `/sequencing/search?q=${encodeURIComponent(normalizedQuery)}`
  )
    .then((results) => {
      movieSearchCache.set(cacheKey, {
        fetchedAt: Date.now(),
        results,
      })
      return results
    })
    .finally(() => {
      movieSearchInflight.delete(cacheKey)
    })

  movieSearchInflight.set(cacheKey, request)
  return request
}
