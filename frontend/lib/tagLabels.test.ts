import { describe, it, expect } from 'vitest'
import { getTagLabel } from './tagLabels'

describe('getTagLabel', () => {
  it('returns Chinese label for known tag in zh locale', () => {
    expect(getTagLabel('twist', 'zh')).toBe('反轉結局')
    expect(getTagLabel('slowburn', 'zh')).toBe('慢熱')
    expect(getTagLabel('dreamlike', 'zh')).toBe('夢境感')
    expect(getTagLabel('broad-comedy', 'zh')).toBe('通俗喜劇')
    expect(getTagLabel('precision', 'zh')).toBe('精密結構')
  })

  it('returns English label for known tag in en locale', () => {
    expect(getTagLabel('twist', 'en')).toBe('Plot twist')
    expect(getTagLabel('slowburn', 'en')).toBe('Slow burn')
    expect(getTagLabel('dreamlike', 'en')).toBe('Dreamlike')
    expect(getTagLabel('broad-comedy', 'en')).toBe('Broad comedy')
    expect(getTagLabel('precision', 'en')).toBe('Precision')
  })

  it('returns raw tag key for unknown tag', () => {
    expect(getTagLabel('unknownTag', 'zh')).toBe('unknownTag')
    expect(getTagLabel('unknownTag', 'en')).toBe('unknownTag')
  })

  it('covers all tags in both locales', () => {
    const knownTags = [
      'twist', 'mindfuck', 'slowburn', 'ensemble', 'solo', 'visualFeast',
      'dialogue', 'tearjerker', 'darkTone', 'uplifting', 'philosophical',
      'satirical', 'nostalgic', 'experimental', 'cult', 'comingOfAge',
      'revenge', 'heist', 'survival', 'timeTravel', 'dystopia', 'trueStory',
      'nonEnglish', 'existential', 'antiHero', 'romanticCore',
      'violentAesthetic', 'socialCritique', 'psychoThriller', 'absurdist',
      'dreamlike', 'melancholic', 'sensual', 'atmospheric', 'intimate',
      'broad-comedy', 'restrained', 'whimsical', 'ornate', 'suspense',
      'ambiguous', 'summer', 'restless', 'precision', 'fractured',
      'memory', 'identity', 'ambiguity',
    ]

    for (const tag of knownTags) {
      const zh = getTagLabel(tag, 'zh')
      const en = getTagLabel(tag, 'en')
      expect(zh).not.toBe(tag) // should resolve to a Chinese label
      expect(en).not.toBe(tag) // should resolve to an English label
    }
  })
})
