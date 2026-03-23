'use client'

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n'

const HTML_LANG_MAP = {
  en: 'en',
  zh: 'zh-TW',
} as const

export default function LocaleDocumentSync() {
  const { locale } = useI18n()

  useEffect(() => {
    document.documentElement.lang = HTML_LANG_MAP[locale]
  }, [locale])

  return null
}
