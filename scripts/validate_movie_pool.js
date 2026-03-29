const fs = require('fs')
const path = require('path')

const poolPath = path.join(__dirname, '..', 'backend', 'app', 'data', 'movie_pool.json')
const poolReviewsPath = path.join(__dirname, '..', 'backend', 'app', 'data', 'movie_pool_reviews.json')
const taxonomyPath = path.join(__dirname, '..', 'backend', 'app', 'data', 'tag_taxonomy.json')

const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'))
const poolReviews = JSON.parse(fs.readFileSync(poolReviewsPath, 'utf8'))
const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'))

const validTags = new Set(Object.keys(taxonomy.tags))
const validConfidence = new Set(['high', 'medium', 'low'])
const validCoverageReason = new Set(['phase1_anchor', 'region_balance', 'tag_coverage'])
const seenIds = new Set()
const errors = []

for (const movie of pool.movies) {
  if (seenIds.has(movie.tmdb_id)) {
    errors.push(`Duplicate tmdb_id: ${movie.tmdb_id} (${movie.title_en})`)
  }
  seenIds.add(movie.tmdb_id)

  for (const tag of movie.tags) {
    if (!validTags.has(tag)) {
      errors.push(`Unknown tag '${tag}' on ${movie.title_en}`)
    }
  }

  if (['us', 'uk'].includes(movie.region) && movie.tags.includes('nonEnglish')) {
    errors.push(`Region/tag conflict on ${movie.title_en}: ${movie.region} + nonEnglish`)
  }

  const review = poolReviews[String(movie.tmdb_id)]
  if (!review) {
    errors.push(`Missing review metadata for ${movie.tmdb_id} (${movie.title_en})`)
    continue
  }

  if (review.title_en !== movie.title_en) {
    errors.push(`Review title mismatch on ${movie.tmdb_id}: '${review.title_en}' vs '${movie.title_en}'`)
  }

  if (!validConfidence.has(review.confidence)) {
    errors.push(`Invalid review confidence on ${movie.tmdb_id}`)
  }

  if (!validCoverageReason.has(review.coverage_reason)) {
    errors.push(`Invalid review coverage_reason on ${movie.tmdb_id}`)
  }

  if (!Array.isArray(review.confounds)) {
    errors.push(`Invalid review confounds on ${movie.tmdb_id}`)
  }

  if (typeof review.replacement_needed !== 'boolean') {
    errors.push(`Invalid review replacement_needed on ${movie.tmdb_id}`)
  }

  if (typeof review.notes !== 'string') {
    errors.push(`Invalid review notes on ${movie.tmdb_id}`)
  }
}

for (const reviewId of Object.keys(poolReviews)) {
  if (!seenIds.has(Number(reviewId))) {
    errors.push(`Review metadata has unknown tmdb_id: ${reviewId}`)
  }
}

if (errors.length > 0) {
  console.error('movie_pool validation failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(`movie_pool validation passed (${pool.movies.length} movies)`)
