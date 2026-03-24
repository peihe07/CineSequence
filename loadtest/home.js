import http from 'k6/http'
import { check, sleep } from 'k6'

import { baseUrl, buildOptions, thinkTimeSeconds } from './config.js'

export const options = buildOptions({
  name: 'homepage_load',
  p95: 800,
  failureRate: 0.01,
})

export default function () {
  const response = http.get(`${baseUrl}/`, {
    headers: {
      Accept: 'text/html',
    },
  })

  check(response, {
    'home status is 200': (res) => res.status === 200,
    'home contains title': (res) => res.body.includes('CineSequence'),
  })

  sleep(thinkTimeSeconds)
}
