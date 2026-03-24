import http from 'k6/http'
import { check, sleep } from 'k6'

import { baseUrl, buildOptions, thinkTimeSeconds } from './config.js'

export const options = buildOptions({
  name: 'sequencing_progress_load',
  p95: 1000,
  failureRate: 0.02,
})

export default function () {
  const response = http.get(`${baseUrl}/sequencing/progress`, {
    headers: {
      Accept: 'application/json',
    },
    redirects: 0,
  })

  check(response, {
    'sequencing progress returns protected-route status': (res) =>
      [200, 302, 307, 401, 403].includes(res.status),
  })

  sleep(thinkTimeSeconds)
}
