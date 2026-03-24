const fs = require('fs')
const path = require('path')

const poolPath = path.join(__dirname, '..', 'backend', 'app', 'data', 'movie_pool.json')
const taxonomyPath = path.join(__dirname, '..', 'backend', 'app', 'data', 'tag_taxonomy.json')

const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'))
const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'))

const validTags = new Set(Object.keys(taxonomy.tags))
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
}

if (errors.length > 0) {
  console.error('movie_pool validation failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(`movie_pool validation passed (${pool.movies.length} movies)`)
