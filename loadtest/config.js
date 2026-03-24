function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function stage(target, duration) {
  return { target, duration }
}

export const baseUrl = __ENV.BASE_URL || 'https://cinesequence.xyz'
export const thinkTimeSeconds = parsePositiveInt(__ENV.THINK_TIME_SECONDS, 1)

const ramp1 = parsePositiveInt(__ENV.RAMP_1_TARGET, 10)
const ramp2 = parsePositiveInt(__ENV.RAMP_2_TARGET, 30)
const ramp3 = parsePositiveInt(__ENV.RAMP_3_TARGET, 50)

export const defaultStages = [
  stage(ramp1, __ENV.RAMP_1_DURATION || '30s'),
  stage(ramp2, __ENV.RAMP_2_DURATION || '30s'),
  stage(ramp3, __ENV.RAMP_3_DURATION || '30s'),
  stage(0, __ENV.RAMP_DOWN_DURATION || '30s'),
]

export function buildOptions({
  name,
  stages = defaultStages,
  p95 = 1000,
  failureRate = 0.01,
}) {
  return {
    scenarios: {
      [name]: {
        executor: 'ramping-vus',
        startVUs: 1,
        stages,
      },
    },
    thresholds: {
      http_req_failed: [`rate<${failureRate}`],
      http_req_duration: [`p(95)<${p95}`],
    },
  }
}
