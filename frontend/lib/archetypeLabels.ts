const ARCHETYPE_LABELS: Record<string, { zh: string; en: string }> = {
  time_traveler: { zh: '時空旅人', en: 'Time Traveler' },
  dark_poet: { zh: '黑暗詩人', en: 'Dark Poet' },
  emotional_sponge: { zh: '情緒海綿', en: 'Emotional Sponge' },
  chaos_theorist: { zh: '混沌理論家', en: 'Chaos Theorist' },
  quiet_observer: { zh: '靜默觀察者', en: 'Quiet Observer' },
  adrenaline_junkie: { zh: '腎上腺素獵人', en: 'Adrenaline Junkie' },
  reality_hunter: { zh: '真實獵手', en: 'Reality Hunter' },
  world_wanderer: { zh: '越境漫遊者', en: 'World Wanderer' },
  master_planner: { zh: '精密佈局師', en: 'Master Planner' },
  dystopia_architect: { zh: '末世建築師', en: 'Dystopia Architect' },
  dream_weaver: { zh: '造夢者', en: 'Dream Weaver' },
  lone_wolf: { zh: '獨行者', en: 'Lone Wolf' },
}

export function getArchetypeLabel(
  archetypeId: string | null | undefined,
  fallbackName: string | null | undefined,
  locale: 'zh' | 'en',
): string {
  if (archetypeId && ARCHETYPE_LABELS[archetypeId]) {
    return ARCHETYPE_LABELS[archetypeId][locale]
  }

  return fallbackName || archetypeId || ''
}
