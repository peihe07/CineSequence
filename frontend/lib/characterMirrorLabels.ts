import type { Locale } from '@/lib/i18n'

const FRAMEWORK_LABELS: Record<string, Record<Locale, string>> = {
  shadow_self: {
    zh: '陰影自我',
    en: 'Shadow Self',
  },
  persona_mask: {
    zh: '人格面具',
    en: 'Persona / Mask',
  },
  attachment_style: {
    zh: '依附模式',
    en: 'Attachment Style',
  },
  individuation: {
    zh: '自性化歷程',
    en: 'Individuation',
  },
  defense_mechanism: {
    zh: '防衛機制',
    en: 'Defense Mechanism',
  },
  existential_crisis: {
    zh: '存在危機',
    en: 'Existential Crisis',
  },
  cognitive_style: {
    zh: '認知風格',
    en: 'Cognitive Style',
  },
}

export function getMirrorFrameworkLabel(framework: string, locale: Locale): string {
  return FRAMEWORK_LABELS[framework]?.[locale] ?? framework
}
