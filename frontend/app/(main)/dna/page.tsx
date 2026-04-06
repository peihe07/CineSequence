'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { PreviewBanner, usePreviewAccess } from '@/components/preview/PreviewGate'
import { ApiError } from '@/lib/api'
import PaymentModal from '@/components/ui/PaymentModal'
import { PREVIEW_DNA_RESULT, PREVIEW_SEQUENCING_PROGRESS } from '@/lib/previewContent'
import { useDnaStore } from '@/stores/dnaStore'
import { useGroupStore } from '@/stores/groupStore'
import { useAuthStore } from '@/stores/authStore'
import { useSequencingStore } from '@/stores/sequencingStore'
import { useI18n } from '@/lib/i18n'
import ArchetypeCard from '@/components/dna/ArchetypeCard'
import StarNebula from '@/components/dna/StarNebula'
import TagCloud from '@/components/dna/TagCloud'
import RadarChart from '@/components/dna/RadarChart'
import AIReading from '@/components/dna/AIReading'
import CharacterMirror from '@/components/dna/CharacterMirror'
import AtmosphereCanvas from '@/components/dna/AtmosphereCanvas'
import Button from '@/components/ui/Button'
import FlowGuard from '@/components/guards/FlowGuard'
import styles from './page.module.css'

export default function DnaResultPage() {
  return (
    <FlowGuard require="sequencing">
      <DnaResultContent />
    </FlowGuard>
  )
}

function DnaResultContent() {
  const router = useRouter()
  const { t } = useI18n()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { isPreview, guardPreviewAction, previewModal } = usePreviewAccess('/dna')
  const { result, isBuilding, isLoading, error, buildDna, fetchResult } = useDnaStore()
  const { autoAssign } = useGroupStore()
  const { progress, fetchProgress, extendSequencing } = useSequencingStore()
  const [paymentContext, setPaymentContext] = useState<'extend' | 'retest' | null>(null)
  const sectionTransition = { duration: 0.65, ease: 'easeOut' as const }
  const displayResult = isPreview ? PREVIEW_DNA_RESULT : result
  const displayProgress = isPreview ? PREVIEW_SEQUENCING_PROGRESS : progress

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    void fetchResult().catch((err) => {
      if (err instanceof ApiError && err.status === 404) {
        void buildDna()
      }
    })
  }, [buildDna, fetchResult, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    void fetchProgress().catch(() => {
      // Keep the DNA result visible even if progress refresh fails.
    })
  }, [fetchProgress, isAuthenticated])

  // Building state — loading animation
  if (!isPreview && (isBuilding || (isLoading && !displayResult))) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <motion.div
            className={styles.dnaHelix}
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <i className="ri-dna-line" style={{ fontSize: '3rem' }} />
          </motion.div>
          <motion.p
            className={styles.loadingText}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {t('dna.analyzing')}
          </motion.p>
        </div>
      </div>
    )
  }

  if (!isPreview && error && !displayResult) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <i className="ri-error-warning-line" style={{ fontSize: '2rem' }} />
          <p>{error}</p>
          <Button variant="secondary" onClick={() => buildDna()}>
            {t('dna.retry')}
          </Button>
        </div>
      </div>
    )
  }

  if (!displayResult) return null

  const canExtend = displayProgress?.can_extend ?? displayResult.can_extend

  async function handleExtend() {
    guardPreviewAction(() => {
      void (async () => {
        try {
          await extendSequencing()
          router.push('/sequencing')
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) {
            setPaymentContext('extend')
          }
        }
      })()
    })
  }

  async function handleEnterTheaters() {
    guardPreviewAction(() => {
      void (async () => {
        await autoAssign()
        router.push('/theaters')
      })()
    })
  }

  return (
    <div className={styles.container}>
      <AtmosphereCanvas archetypeId={displayResult.archetype.id} />
      <motion.div
        className={styles.content}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.section
          className={`${styles.section} ${styles.heroSection}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={sectionTransition}
        >
          <span className={styles.sideLabel}>{t('dna.fileLabel')}</span>
          <p className={styles.eyebrow}>{t('dna.eyebrow')}</p>
          <motion.h1
            className={styles.title}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {t('dna.title')}
          </motion.h1>
          <p className={styles.deck}>
            {t('dna.deck')}
          </p>
          <p className={styles.heroMeta}>{t('dna.heroMeta')}</p>
          <PreviewBanner nextPath="/dna" compact />
        </motion.section>

        <motion.section
          className={`${styles.section} ${styles.topRow}`}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...sectionTransition, delay: 0.08 }}
        >
          <StarNebula
            genreVector={displayResult.genre_vector}
            archetypeId={displayResult.archetype.id}
          />
          <ArchetypeCard archetype={displayResult.archetype} />
        </motion.section>

        <motion.section
          className={`${styles.section} ${styles.grid}`}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...sectionTransition, delay: 0.14 }}
        >
          <RadarChart scores={displayResult.quadrant_scores} />
          <TagCloud tagLabels={displayResult.tag_labels} />
        </motion.section>

        <motion.section
          className={`${styles.section} ${styles.readingSection}`}
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...sectionTransition, delay: 0.2 }}
        >
          <AIReading
            topTags={displayResult.top_tags}
            supportingSignals={displayResult.supporting_signals}
            avoidedSignals={displayResult.avoided_signals}
            mixedSignals={displayResult.mixed_signals}
            comparisonEvidence={displayResult.comparison_evidence}
            personalityReading={displayResult.personality_reading}
            hiddenTraits={displayResult.hidden_traits}
            conversationStyle={displayResult.conversation_style}
            idealMovieDate={displayResult.ideal_movie_date}
          />
        </motion.section>

        {!isPreview && (
          <motion.section
            className={`${styles.section} ${styles.mirrorSection}`}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...sectionTransition, delay: 0.24 }}
          >
            <CharacterMirror />
          </motion.section>
        )}

        <motion.section
          className={`${styles.section} ${styles.diagnosticsSection}`}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...sectionTransition, delay: 0.28 }}
        >
          <p className={styles.diagnosticsEyebrow}>{t('dna.diagnosticsLabel')}</p>
          <div className={styles.diagnosticsGrid}>
            <div className={styles.diagnosticsCard}>
              <span className={styles.diagnosticsValue}>{displayResult.interaction_diagnostics.explicit_pick_count}</span>
              <span className={styles.diagnosticsText}>{t('dna.diagnosticsPicks')}</span>
            </div>
            <div className={styles.diagnosticsCard}>
              <span className={styles.diagnosticsValue}>{displayResult.interaction_diagnostics.skip_count}</span>
              <span className={styles.diagnosticsText}>{t('dna.diagnosticsSkips')}</span>
            </div>
            <div className={styles.diagnosticsCard}>
              <span className={styles.diagnosticsValue}>{displayResult.interaction_diagnostics.dislike_both_count}</span>
              <span className={styles.diagnosticsText}>{t('dna.diagnosticsDislikes')}</span>
            </div>
          </div>
        </motion.section>

        <motion.section
          className={`${styles.section} ${styles.actions}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...sectionTransition, delay: 0.28 }}
        >
          <div className={styles.actionsHeader}>
            <p className={styles.actionEyebrow}>{t('dna.nextStepLabel')}</p>
            <h2 className={styles.actionTitle}>{t('dna.nextStepTitle')}</h2>
            <p className={styles.actionIntro}>{t('dna.nextStepBody')}</p>
          </div>
          <div className={styles.actionGrid}>
            <div className={styles.primaryActionCard}>
              <p className={styles.actionCardLabel}>{t('dna.enterTheaters')}</p>
              <p className={styles.actionCardBody}>{t('dna.enterTheatersHint')}</p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => void handleEnterTheaters()}
              >
                <i className="ri-movie-line" /> {t('dna.enterTheaters')}
              </Button>
            </div>
            <div className={styles.secondaryActionStack}>
              <div className={styles.secondaryActionCard}>
                <p className={styles.actionCardLabel}>{t('dna.findMatches')}</p>
                <p className={styles.actionCardBody}>{t('dna.findMatchesHint')}</p>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => guardPreviewAction(() => router.push('/matches'))}
                >
                  <i className="ri-group-line" /> {t('dna.findMatches')}
                </Button>
              </div>
              {canExtend && (
                <div className={styles.secondaryActionCard}>
                  <p className={styles.actionCardLabel}>{t('complete.extend')}</p>
                  <p className={styles.actionCardBody}>{t('dna.extendHint')}</p>
                  <p className={styles.actionCardMeta}>{t('dna.extendUnlocks')}</p>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => void handleExtend()}
                  >
                    <i className="ri-add-line" /> {t('complete.extend')}
                  </Button>
                  <Link href="/pricing" className={styles.actionLink}>
                    {t('dna.viewPricing')}
                  </Link>
                </div>
              )}
              <div className={styles.secondaryActionCard}>
                <p className={styles.actionCardLabel}>{t('profile.retest')}</p>
                <p className={styles.actionCardBody}>{t('dna.retestHint')}</p>
                <p className={styles.actionCardMeta}>{t('dna.retestUnlocks')}</p>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setPaymentContext('retest')}
                >
                  <i className="ri-refresh-line" /> {t('profile.retest')}
                </Button>
                <Link href="/pricing" className={styles.actionLink}>
                  {t('dna.viewPricing')}
                </Link>
                </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          className={styles.section}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...sectionTransition, delay: 0.34 }}
        >
          <p className={styles.disclaimer}>{t('dna.disclaimer')}</p>
        </motion.section>
      </motion.div>
      {previewModal}
      {paymentContext && (
        <PaymentModal
          open
          context={paymentContext}
          onClose={() => setPaymentContext(null)}
        />
      )}
    </div>
  )
}
