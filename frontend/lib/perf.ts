const PERF_ENABLED =
  typeof process !== 'undefined'
  && process.env.NODE_ENV !== 'production'
  && process.env.NODE_ENV !== 'test'

export function logPerf(label: string, durationMs: number, meta?: Record<string, unknown>): void {
  if (!PERF_ENABLED || typeof console === 'undefined') {
    return
  }

  const rounded = Math.round(durationMs)
  if (meta) {
    console.info(`[perf] ${label}: ${rounded}ms`, meta)
    return
  }

  console.info(`[perf] ${label}: ${rounded}ms`)
}
