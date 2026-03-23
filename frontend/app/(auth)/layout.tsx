import styles from './layout.module.css'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      <span className={styles.sideLabel}>ACCESS</span>
      <div className={styles.backdrop} aria-hidden="true" />
      <section className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandScript}>Cine</span>
          <span className={styles.brandMono}>Sequence</span>
        </div>
        <span className={styles.watermark} aria-hidden="true">Entry</span>
        <div className={styles.content}>{children}</div>
      </section>
    </main>
  )
}
