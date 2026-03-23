import styles from './layout.module.css'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        {children}
      </section>
    </main>
  )
}
