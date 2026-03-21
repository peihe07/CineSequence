'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSequencingStore } from '@/stores/sequencingStore'
import { useDnaStore } from '@/stores/dnaStore'
import styles from './page.module.css'

export default function SequencingCompletePage() {
  const router = useRouter()
  const { progress, fetchProgress, extendSequencing } = useSequencingStore()
  const { buildDna } = useDnaStore()

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  const handleViewDna = async () => {
    await buildDna()
    router.push('/dna')
  }

  const handleExtend = async () => {
    await extendSequencing()
    router.push('/sequencing')
  }

  const extensionBatches = progress?.extension_batches ?? 0
  const maxBatches = progress?.max_extension_batches ?? 3
  const canExtend = progress?.can_extend ?? false
  const totalRounds = progress?.total_rounds ?? 20

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.icon}>
          <i className="ri-dna-line ri-3x" />
        </div>

        <h1 className={styles.title}>Sequencing Complete</h1>
        <p className={styles.subtitle}>
          {totalRounds} rounds completed — your cinematic DNA is ready to be decoded.
        </p>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{totalRounds}</span>
            <span className={styles.statLabel}>ROUNDS</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{extensionBatches}/{maxBatches}</span>
            <span className={styles.statLabel}>EXTENSIONS</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={handleViewDna}>
            <i className="ri-eye-line" /> View My DNA
          </button>

          {canExtend && (
            <button className={styles.secondaryBtn} onClick={handleExtend}>
              <i className="ri-add-line" /> Refine DNA (+5 rounds)
            </button>
          )}
        </div>

        {canExtend && (
          <p className={styles.hint}>
            Want more accuracy? Add 5 more rounds to refine your DNA profile.
            {maxBatches - extensionBatches} extensions remaining.
          </p>
        )}

        {!canExtend && extensionBatches > 0 && (
          <p className={styles.hint}>
            Maximum extensions reached. Your DNA is as refined as it gets!
          </p>
        )}
      </motion.div>
    </div>
  )
}
