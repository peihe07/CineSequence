import path from 'node:path'
import type { NextConfig } from 'next'

const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, '')

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async rewrites() {
    if (!apiProxyTarget) {
      return []
    }

    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/:path*`,
      },
    ]
  },
}

export default nextConfig
