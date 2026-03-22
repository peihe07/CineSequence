/**
 * Lightweight sound effect manager.
 * Lazy-loads Audio objects on first play; respects mute preference in localStorage.
 */

const STORAGE_KEY = 'cineseq-muted'

type SoundName = 'pick' | 'skip' | 'flip' | 'tear' | 'complete' | 'match'

const SOUND_FILES: Record<SoundName, string> = {
  pick: '/sounds/pick.mp3',
  skip: '/sounds/skip.mp3',
  flip: '/sounds/flip.mp3',
  tear: '/sounds/tear.mp3',
  complete: '/sounds/complete.mp3',
  match: '/sounds/match.mp3',
}

class SoundManager {
  private cache = new Map<SoundName, HTMLAudioElement>()
  private _muted: boolean

  constructor() {
    this._muted =
      typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY) === 'true'
        : true
  }

  get muted(): boolean {
    return this._muted
  }

  setMuted(value: boolean): void {
    this._muted = value
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(value))
    }
  }

  toggle(): boolean {
    this.setMuted(!this._muted)
    return this._muted
  }

  play(name: SoundName): void {
    if (this._muted || typeof window === 'undefined') return

    let audio = this.cache.get(name)
    if (!audio) {
      audio = new Audio(SOUND_FILES[name])
      audio.volume = 0.3
      this.cache.set(name, audio)
    }

    // Reset and play — allow overlapping by cloning if already playing
    audio.currentTime = 0
    audio.play().catch(() => {
      // Ignore autoplay policy errors
    })
  }
}

// Singleton
export const soundManager = new SoundManager()
export type { SoundName }
