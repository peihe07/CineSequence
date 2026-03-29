const fs = require('fs')
const path = require('path')

const pairsPath = path.join(__dirname, '..', 'backend', 'app', 'data', 'phase1_pairs.json')
const reviewsPath = path.join(__dirname, '..', 'backend', 'app', 'data', 'phase1_pair_reviews.json')
const taxonomyPath = path.join(__dirname, '..', 'backend', 'app', 'data', 'tag_taxonomy.json')

const pairs = JSON.parse(fs.readFileSync(pairsPath, 'utf8'))
const reviews = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'))
const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'))
const validConfidence = new Set(['high', 'medium', 'low'])

const requiredCoreDimensions = new Set([
  'mainstream_vs_independent',
  'rational_vs_emotional',
  'light_vs_dark',
])
const supplementaryDimensions = new Set([
  'fast_vs_slow',
  'ensemble_vs_solo',
  'visual_vs_dialogue',
  'spectacle_vs_intimate',
  'straightforward_vs_meta',
  'realism_vs_fantasy',
  'contemporary_vs_period',
  'cynical_vs_sincere',
])
const validDimensions = new Set([
  ...requiredCoreDimensions,
  ...supplementaryDimensions,
])

const errors = []
const ids = new Set()
const tmdbIds = new Map()
const counts = {}

for (const pair of pairs) {
  if (ids.has(pair.id)) {
    errors.push(`Duplicate pair id: ${pair.id}`)
  }
  ids.add(pair.id)

  if (!validDimensions.has(pair.dimension)) {
    errors.push(`Unknown dimension '${pair.dimension}' on ${pair.id}`)
  }

  if (!pair.label || typeof pair.label !== 'string') {
    errors.push(`Missing label on ${pair.id}`)
  }

  if (!pair.movie_a || !pair.movie_b) {
    errors.push(`Missing movie payload on ${pair.id}`)
    continue
  }

  for (const side of ['movie_a', 'movie_b']) {
    const tmdbId = pair[side].tmdb_id
    if (tmdbIds.has(tmdbId)) {
      errors.push(
        `Duplicate TMDB id across pairs: ${tmdbId} in ${tmdbIds.get(tmdbId)} and ${pair.id} (${side})`
      )
    } else {
      tmdbIds.set(tmdbId, `${pair.id} (${side})`)
    }
  }

  if (pair.movie_a.tmdb_id === pair.movie_b.tmdb_id) {
    errors.push(`Pair ${pair.id} uses the same TMDB id for both sides`)
  }

  if (!Number.isInteger(pair.movie_a.tmdb_id) || pair.movie_a.tmdb_id <= 0) {
    errors.push(`Invalid movie_a tmdb_id on ${pair.id}`)
  }

  if (!Number.isInteger(pair.movie_b.tmdb_id) || pair.movie_b.tmdb_id <= 0) {
    errors.push(`Invalid movie_b tmdb_id on ${pair.id}`)
  }

  counts[pair.dimension] = (counts[pair.dimension] || 0) + 1

  const review = reviews[pair.id]
  if (!review || typeof review !== 'object') {
    errors.push(`Missing review metadata for ${pair.id}`)
    continue
  }

  if (!validConfidence.has(review.confidence)) {
    errors.push(`Invalid review confidence on ${pair.id}: ${review.confidence}`)
  }

  if (!Array.isArray(review.confounds)) {
    errors.push(`Invalid review confounds on ${pair.id}`)
  }

  if (!review.why_valid || typeof review.why_valid !== 'string') {
    errors.push(`Missing why_valid on ${pair.id}`)
  }

  if (typeof review.replacement_needed !== 'boolean') {
    errors.push(`Invalid replacement_needed on ${pair.id}`)
  }
}

for (const reviewId of Object.keys(reviews)) {
  if (!ids.has(reviewId)) {
    errors.push(`Review metadata has unknown pair id: ${reviewId}`)
  }
}

for (const dimension of requiredCoreDimensions) {
  if ((counts[dimension] || 0) === 0) {
    errors.push(`Missing required core dimension: ${dimension}`)
  }
}

for (const [axisKey, config] of Object.entries(taxonomy.quadrant_axes || {})) {
  if (!Array.isArray(config.range) || config.range.length !== 2) {
    errors.push(`Invalid quadrant axis range for ${axisKey}`)
  }
}

if (errors.length > 0) {
  console.error('phase1_pairs validation failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(`phase1_pairs validation passed (${pairs.length} pairs)`)
