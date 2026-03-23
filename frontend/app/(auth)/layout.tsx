import FloatingLocaleToggle from '@/components/ui/FloatingLocaleToggle'
import styles from './layout.module.css'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      <FloatingLocaleToggle />
      <div className={styles.sideLabelGroup}>
        <span className={styles.sideLabel}>ACCESS</span>
        <div className={styles.sideLine} />
      </div>
      <div className={styles.backdrop} aria-hidden="true" />
      <section className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandScript}>Cine</span>
          <span className={styles.brandMono}>Sequence</span>
        </div>
        <div className={styles.content}>{children}</div>
      </section>
    </main>
  )
}
