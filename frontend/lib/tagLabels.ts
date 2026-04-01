/**
 * Shared tag label maps for displaying taste tags in zh/en.
 * Source of truth — used by matches, theaters, ticket pages.
 */

import type { Locale } from './i18n'

const TAG_ZH: Record<string, string> = {
  twist: '反轉結局', mindfuck: '燒腦', slowburn: '慢熱', ensemble: '群戲',
  solo: '獨角戲', visualFeast: '視覺饗宴', dialogue: '對白精彩', tearjerker: '催淚',
  darkTone: '黑暗', uplifting: '正能量', philosophical: '哲學思辨', satirical: '社會諷刺',
  nostalgic: '懷舊', experimental: '實驗性', cult: '邪典', comingOfAge: '成長故事',
  revenge: '復仇', heist: '精密計畫', survival: '生存掙扎', timeTravel: '時空穿越',
  dystopia: '反烏托邦', trueStory: '真實事件', nonEnglish: '非英語',
  existential: '存在主義', antiHero: '反英雄', romanticCore: '浪漫內核',
  violentAesthetic: '暴力美學', socialCritique: '社會批判', psychoThriller: '心理驚悚',
  absurdist: '荒誕', dreamlike: '夢境感', melancholic: '憂鬱氣質',
  sensual: '感官流動', atmospheric: '氛圍濃厚', intimate: '親密感',
  'broad-comedy': '通俗喜劇', restrained: '克制內斂', whimsical: '奇想感',
  ornate: '繁複華麗', suspense: '懸念', ambiguous: '曖昧未明',
  summer: '夏日氣息', restless: '躁動感', precision: '精密結構',
  fractured: '破碎敘事', memory: '記憶迷宮', identity: '身份裂縫',
  ambiguity: '模糊性',
}

const TAG_EN: Record<string, string> = {
  twist: 'Plot twist', mindfuck: 'Mind-bending', slowburn: 'Slow burn', ensemble: 'Ensemble',
  solo: 'Solo act', visualFeast: 'Visual feast', dialogue: 'Sharp dialogue', tearjerker: 'Tearjerker',
  darkTone: 'Dark', uplifting: 'Uplifting', philosophical: 'Philosophical', satirical: 'Satirical',
  nostalgic: 'Nostalgic', experimental: 'Experimental', cult: 'Cult', comingOfAge: 'Coming of age',
  revenge: 'Revenge', heist: 'Heist', survival: 'Survival', timeTravel: 'Time travel',
  dystopia: 'Dystopia', trueStory: 'True story', nonEnglish: 'Non-English',
  existential: 'Existential', antiHero: 'Anti-hero', romanticCore: 'Romantic',
  violentAesthetic: 'Violent aesthetic', socialCritique: 'Social critique', psychoThriller: 'Psychological',
  absurdist: 'Absurdist', dreamlike: 'Dreamlike', melancholic: 'Melancholic',
  sensual: 'Sensual', atmospheric: 'Atmospheric', intimate: 'Intimate',
  'broad-comedy': 'Broad comedy', restrained: 'Restrained', whimsical: 'Whimsical',
  ornate: 'Ornate', suspense: 'Suspense', ambiguous: 'Ambiguous',
  summer: 'Summer', restless: 'Restless', precision: 'Precision',
  fractured: 'Fractured', memory: 'Memory', identity: 'Identity',
  ambiguity: 'Ambiguity',
}

export function getTagLabel(tag: string, locale: Locale): string {
  const map = locale === 'zh' ? TAG_ZH : TAG_EN
  return map[tag] || tag
}
