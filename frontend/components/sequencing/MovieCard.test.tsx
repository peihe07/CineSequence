/* eslint-disable @next/next/no-img-element */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { onPickMock, setAmbientColorMock, playMock } = vi.hoisted(() => ({
  onPickMock: vi.fn(),
  setAmbientColorMock: vi.fn(),
  playMock: vi.fn(),
}))

vi.mock('framer-motion', () => ({
  motion: {
    button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => {
      const cleanProps = { ...props }
      delete cleanProps.whileHover
      delete cleanProps.whileTap
      delete cleanProps.initial
      delete cleanProps.animate
      delete cleanProps.exit
      delete cleanProps.transition
      return <button {...cleanProps}>{props.children}</button>
    },
  },
}))

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt} />,
}))

vi.mock('@/stores/sequencingStore', () => ({
  useSequencingStore: (selector: (state: { setAmbientColor: typeof setAmbientColorMock }) => unknown) =>
    selector({ setAmbientColor: setAmbientColorMock }),
}))

vi.mock('@/lib/sound', () => ({
  soundManager: {
    play: playMock,
  },
}))

import MovieCard from './MovieCard'

describe('MovieCard', () => {
  beforeEach(() => {
    onPickMock.mockReset()
    setAmbientColorMock.mockReset()
    playMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders as a clickable button and triggers pick on tap', () => {
    render(
      <MovieCard
        movie={{
          tmdb_id: 1,
          title_en: 'Inception',
          title_zh: '全面啟動',
          poster_url: null,
          year: 2010,
          genres: ['Science Fiction'],
        }}
        onPick={onPickMock}
        side="left"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '全面啟動' }))

    expect(playMock).toHaveBeenCalledWith('pick')
    expect(onPickMock).toHaveBeenCalledTimes(1)
  })
})
