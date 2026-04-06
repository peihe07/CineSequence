import type { HTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock, localeState, submitMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  localeState: {
    locale: 'en' as 'en' | 'zh',
  },
  submitMock: vi.fn(),
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    locale: localeState.locale,
    setLocale: vi.fn(),
    t: (key: string) => {
      const dict: Record<'en' | 'zh', Record<string, string>> = {
        en: {
          'payment.context.extend.title': 'Request Sequencing Clearance',
          'payment.context.extend.description': 'Declassify 10 additional rounds to go deeper into your cinematic profile.',
          'payment.context.retest.title': 'Request Full Re-Sequence',
          'payment.context.retest.description': 'Declassify a clean 30-round readout and refresh your dossier.',
          'payment.context.invite.title': 'Request Channel Clearance',
          'payment.context.invite.description': 'Restore contact privileges and reopen invite channels.',
          'payment.context.shareCard.title': 'Request Clean Share Export',
          'payment.context.shareCard.description': 'Declassify a premium DNA card built for external circulation.',
          'payment.product.extension.name': 'CLEARANCE LEVEL: EXTENSION +10',
          'payment.product.extension.detail': 'Declassify 10 additional sequencing rounds.',
          'payment.product.bundle.name': 'CLEARANCE LEVEL: DOSSIER BUNDLE',
          'payment.product.bundle.detail': 'Declassify 1 full re-sequence plus 2 extension clearances.',
          'payment.product.retest.name': 'CLEARANCE LEVEL: FULL RE-SEQUENCE',
          'payment.product.retest.detail': 'Declassify a fresh 30-round sequencing pass.',
          'payment.product.inviteUnlock.name': 'CLEARANCE LEVEL: OPEN CHANNELS',
          'payment.product.inviteUnlock.detail': 'Declassify unlimited invite access with no expiry.',
          'payment.product.shareCard.name': 'CLEARANCE LEVEL: CLEAN SHARE CARD',
          'payment.product.shareCard.detail': 'Declassify a high-resolution DNA export for sharing.',
          'payment.submit': 'REQUEST CLEARANCE',
          'payment.processing': 'DECLASSIFYING...',
          'payment.note': 'Secure clearance processed via ECPay. Declassified credits are non-refundable.',
          'payment.close': 'Close',
        },
        zh: {
          'payment.context.extend.title': '申請延伸權限',
          'payment.context.extend.description': '解密額外 10 輪定序，繼續深入你的觀影輪廓。',
          'payment.context.retest.title': '申請重新定序',
          'payment.context.retest.description': '解密全新 30 輪報告，更新你的觀影檔案。',
          'payment.context.invite.title': '申請通聯權限',
          'payment.context.invite.description': '恢復聯絡權限，重新開啟邀請通道。',
          'payment.context.shareCard.title': '申請高階分享卡',
          'payment.context.shareCard.description': '解密高解析 DNA 分享卡，用於對外展示。',
          'payment.product.extension.name': '解密等級：延伸 +10',
          'payment.product.extension.detail': '解密額外 10 輪定序機會。',
          'payment.product.bundle.name': '解密等級：組合檔案',
          'payment.product.bundle.detail': '解密 1 次完整重測與 2 次延伸權限。',
          'payment.product.retest.name': '解密等級：完整重測',
          'payment.product.retest.detail': '解密全新 30 輪定序流程。',
          'payment.product.inviteUnlock.name': '解密等級：開放通聯',
          'payment.product.inviteUnlock.detail': '解密永久邀請權限，無使用期限。',
          'payment.product.shareCard.name': '解密等級：高解析分享卡',
          'payment.product.shareCard.detail': '解密高解析 DNA 分享卡，用於社群發佈。',
          'payment.submit': 'REQUEST CLEARANCE',
          'payment.processing': '正在解密...',
          'payment.note': '付款由 ECPay 安全處理。已解密權限恕不退款。',
          'payment.close': '關閉',
        },
      }
      return dict[localeState.locale][key] ?? key
    },
  }),
}))

import PaymentModal from './PaymentModal'

describe('PaymentModal', () => {
  beforeEach(() => {
    apiMock.mockReset()
    submitMock.mockReset()
    localeState.locale = 'en'

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options)
      if (tagName === 'div') {
        Object.defineProperty(element, 'innerHTML', {
          configurable: true,
          set: () => {},
        })
        vi.spyOn(element, 'querySelector').mockReturnValue({ submit: submitMock } as unknown as HTMLFormElement)
      }
      return element
    }) as typeof document.createElement)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('renders clearance-oriented copy for extend context', () => {
    render(<PaymentModal open={true} onClose={vi.fn()} context="extend" />)

    expect(screen.getByRole('dialog', { name: 'Request Sequencing Clearance' })).toBeTruthy()
    expect(screen.getByText('CLEARANCE LEVEL: EXTENSION +10')).toBeTruthy()
    expect(screen.getByText('CLEARANCE LEVEL: DOSSIER BUNDLE')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'REQUEST CLEARANCE' })).toBeTruthy()
  })

  it('renders translated clearance copy in chinese', () => {
    localeState.locale = 'zh'

    render(<PaymentModal open={true} onClose={vi.fn()} context="invite" />)

    expect(screen.getByRole('dialog', { name: '申請通聯權限' })).toBeTruthy()
    expect(screen.getByText('解密等級：開放通聯')).toBeTruthy()
    expect(screen.getByText('付款由 ECPay 安全處理。已解密權限恕不退款。')).toBeTruthy()
  })

  it('submits the selected product through checkout', async () => {
    apiMock.mockResolvedValue({ order_no: 'ord_123', ecpay_form_html: '<form></form>' })

    render(<PaymentModal open={true} onClose={vi.fn()} context="retest" />)

    fireEvent.click(screen.getByText('CLEARANCE LEVEL: DOSSIER BUNDLE'))
    fireEvent.click(screen.getByRole('button', { name: 'REQUEST CLEARANCE' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ product_type: 'bundle' }),
      })
    })
    expect(submitMock).toHaveBeenCalledTimes(1)
  })
})
