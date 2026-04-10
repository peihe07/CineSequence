'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import zhTranslations from '@/locales/zh.json'
import enTranslations from '@/locales/en.json'

export type Locale = 'zh' | 'en'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
})

const STORAGE_KEY = 'cinesequence-locale'

const translations: Record<Locale, Record<string, string>> = {
  zh: zhTranslations,
  en: enTranslations,
}

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en'
  }

  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'zh' || saved === 'en' ? saved : 'en'
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text
  let result = text
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{{${k}}}`, String(v))
  }
  return result
}

export function translateStatic(key: string, vars?: Record<string, string | number>): string {
  const dict = translations[getStoredLocale()]
  return interpolate(dict[key] ?? key, vars)
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getStoredLocale())

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = translations[locale]
      return interpolate(dict[key] ?? key, vars)
    },
    [locale],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
