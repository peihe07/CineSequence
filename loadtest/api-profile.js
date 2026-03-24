import http from 'k6/http'
import { check, sleep } from 'k6'

import { baseUrl, buildOptions, thinkTimeSeconds } from './config.js'

export const options = buildOptions({
  name: 'api_profile_load',
  p95: 1000,
  failureRate: 0.02,
})

export default function () {
  const response = http.get(`${baseUrl}/api/profile`, {
    headers: {
      Accept: 'application/json',
    },
    responseCallback: http.expectedStatuses(200, 401, 403),
  })

  check(response, {
    'profile status is auth-boundary response': (res) => [200, 401, 403].includes(res.status),
    'profile response is json': (res) =>
      (res.headers['Content-Type'] || res.headers['content-type'] || '').includes('application/json'),
  })

  sleep(thinkTimeSeconds)
}
