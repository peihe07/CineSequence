import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import MainLoading from './loading'

describe('MainLoading', () => {
  it('renders a visible loading state instead of an empty screen', () => {
    render(<MainLoading />)

    expect(screen.getByText('Loading...')).toBeTruthy()
  })
})
