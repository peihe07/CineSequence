import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  // Static export doesn't need file tracing, but keep for local dev builds.
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    // Static export requires unoptimized images (no server-side optimization).
    unoptimized: true,
  },
}

export default nextConfig
