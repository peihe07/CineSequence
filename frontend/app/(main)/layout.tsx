'use client'

import Header from '@/components/ui/Header'
import NavBar from '@/components/ui/NavBar'
import AuthGuard from '@/components/guards/AuthGuard'
import styles from './layout.module.css'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className={styles.shell}>
        <Header />
        <div className={styles.page}>{children}</div>
        <NavBar />
      </div>
    </AuthGuard>
  )
}
