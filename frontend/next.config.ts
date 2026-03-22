import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // This repo has lockfiles at both the project root and frontend root.
  // Pin tracing to the frontend app directory so Next doesn't infer the wrong workspace root.
  outputFileTracingRoot: path.resolve(__dirname),
}

export default nextConfig
