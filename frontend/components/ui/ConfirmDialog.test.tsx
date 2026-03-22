import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Hoist mocks so they are available for vi.mock factory functions
const { onConfirmMock, onCancelMock } = vi.hoisted(() => ({
  onConfirmMock: vi.fn(),
  onCancelMock: vi.fn(),
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      if (key === 'common.cancel') return 'Cancel'
      if (key === 'common.confirm') return 'Confirm'
      return key
    },
  }),
}))

// CSS module stub — vitest does not load real CSS
vi.mock('./ConfirmDialog.module.css', () => ({
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}))

// Import component AFTER all vi.mock calls
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
  beforeEach(() => {
    onConfirmMock.mockReset()
    onCancelMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when open is false', () => {
    render(
      <ConfirmDialog
        open={false}
        message="Are you sure?"
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />,
    )

    expect(screen.queryByText('Are you sure?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('renders the message and action buttons when open is true', () => {
    render(
      <ConfirmDialog
        open={true}
        message="Delete this item?"
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />,
    )

    expect(screen.getByText('Delete this item?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('calls onConfirm when the confirm button is clicked', () => {
    render(
      <ConfirmDialog
        open={true}
        message="Proceed?"
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirmMock).toHaveBeenCalledTimes(1)
    expect(onCancelMock).not.toHaveBeenCalled()
  })

  it('calls onCancel when the cancel button is clicked', () => {
    render(
      <ConfirmDialog
        open={true}
        message="Proceed?"
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancelMock).toHaveBeenCalledTimes(1)
    expect(onConfirmMock).not.toHaveBeenCalled()
  })

  it('calls onCancel when the overlay backdrop is clicked', () => {
    const { container } = render(
      <ConfirmDialog
        open={true}
        message="Proceed?"
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />,
    )

    // The outermost div is the overlay — click it directly
    const overlay = container.firstChild as HTMLElement
    fireEvent.click(overlay)

    expect(onCancelMock).toHaveBeenCalledTimes(1)
    expect(onConfirmMock).not.toHaveBeenCalled()
  })

  it('does not propagate clicks from the dialog box to the overlay', () => {
    render(
      <ConfirmDialog
        open={true}
        message="Proceed?"
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />,
    )

    // Clicking the message text (inside the dialog) should not fire onCancel
    fireEvent.click(screen.getByText('Proceed?'))

    expect(onCancelMock).not.toHaveBeenCalled()
    expect(onConfirmMock).not.toHaveBeenCalled()
  })
})
