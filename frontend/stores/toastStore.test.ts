import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// No external module mocks needed — toastStore uses only zustand and crypto.randomUUID

import { useToastStore } from './toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useToastStore.setState({ toasts: [] })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    useToastStore.setState({ toasts: [] })
  })

  it('addToast adds a toast to the array', () => {
    useToastStore.getState().addToast('info', 'Hello world')

    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('info')
    expect(toasts[0].message).toBe('Hello world')
    expect(typeof toasts[0].id).toBe('string')
  })

  it('removeToast removes a toast by id', () => {
    useToastStore.getState().addToast('success', 'Done')

    const { toasts } = useToastStore.getState()
    const id = toasts[0].id

    useToastStore.getState().removeToast(id)

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('addToast auto-removes after the default duration', () => {
    useToastStore.getState().addToast('error', 'Something failed')

    expect(useToastStore.getState().toasts).toHaveLength(1)

    // Advance time past the default 3000 ms duration
    vi.advanceTimersByTime(3000)

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('addToast auto-removes after a custom duration', () => {
    useToastStore.getState().addToast('info', 'Custom duration', 1500)

    expect(useToastStore.getState().toasts).toHaveLength(1)

    // Should still be present just before the custom duration
    vi.advanceTimersByTime(1499)
    expect(useToastStore.getState().toasts).toHaveLength(1)

    // Should be gone at exactly the custom duration
    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('multiple toasts can coexist', () => {
    useToastStore.getState().addToast('info', 'First')
    useToastStore.getState().addToast('success', 'Second')
    useToastStore.getState().addToast('error', 'Third')

    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(3)
    expect(toasts.map((t) => t.message)).toEqual(['First', 'Second', 'Third'])
  })

  it('auto-removal of one toast does not remove others', () => {
    useToastStore.getState().addToast('info', 'Short-lived', 500)
    useToastStore.getState().addToast('info', 'Long-lived', 5000)

    vi.advanceTimersByTime(500)

    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('Long-lived')
  })
})
