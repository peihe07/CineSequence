import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider, useI18n } from './i18n'

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n()

  return (
    <>
      <span>{locale}</span>
      <span>{t('nav.theaters')}</span>
      <button type="button" onClick={() => setLocale('zh')}>
        set-zh
      </button>
      <button type="button" onClick={() => setLocale('en')}>
        set-en
      </button>
    </>
  )
}

describe('I18nProvider', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('hydrates locale from localStorage on first render', () => {
    localStorage.setItem('cinesequence-locale', 'zh')

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    expect(screen.getByText('zh')).toBeTruthy()
    expect(screen.getByText('放映廳')).toBeTruthy()
  })

  it('persists locale changes', () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'set-zh' }))
    expect(localStorage.getItem('cinesequence-locale')).toBe('zh')

    fireEvent.click(screen.getByRole('button', { name: 'set-en' }))
    expect(localStorage.getItem('cinesequence-locale')).toBe('en')
  })
})
