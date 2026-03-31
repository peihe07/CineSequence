'use client'

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { useDnaStore } from '@/stores/dnaStore'
import styles from './CharacterMirror.module.css'

const FRAMEWORK_LABEL: Record<string, string> = {
  shadow_self: 'Shadow Self',
  persona_mask: 'Persona / Mask',
  attachment_style: 'Attachment Style',
  individuation: 'Individuation',
  defense_mechanism: 'Defense Mechanism',
  existential_crisis: 'Existential Crisis',
  cognitive_style: 'Cognitive Style',
}

export default function CharacterMirror() {
  const { t } = useI18n()
  const { mirrorCharacters, isMirrorLoading, mirrorError, fetchMirror } = useDnaStore()

  useEffect(() => {
    if (!mirrorCharacters && !isMirrorLoading && !mirrorError) {
      void fetchMirror()
    }
  }, [mirrorCharacters, isMirrorLoading, mirrorError, fetchMirror])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>{t('dna.mirrorLabel')}</p>
        <p className={styles.deck}>{t('dna.mirrorDeck')}</p>
      </div>

      {isMirrorLoading && (
        <>
          <p className={styles.loading}>{t('dna.mirrorLoading')}</p>
          <div className={styles.skeleton}>
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
          </div>
        </>
      )}

      {mirrorError && !isMirrorLoading && (
        <p className={styles.errorText}>{t('dna.mirrorError')}</p>
      )}

      {mirrorCharacters && !isMirrorLoading && (
        <div className={styles.cards}>
          {mirrorCharacters.map((char) => (
            <div key={char.id} className={styles.card}>
              <div className={styles.cardTop}>
                <h3 className={styles.characterName}>{char.name}</h3>
                <p className={styles.movieTitle}>{char.movie}</p>
              </div>

              <p className={styles.oneLiner}>"{char.one_liner}"</p>

              <div className={styles.meta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>{t('dna.mirrorFramework')}</span>
                  <span className={styles.metaValue}>
                    {FRAMEWORK_LABEL[char.psych_framework] ?? char.psych_framework}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>{t('dna.mirrorScore')}</span>
                  <span className={styles.metaValue}>
                    {Math.round(char.score * 100)}%
                  </span>
                </div>
              </div>

              {char.mirror_reading && (
                <>
                  <div className={styles.divider} />
                  <p className={styles.mirrorReading}>{char.mirror_reading}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
