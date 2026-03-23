'use client'

import Header from '@/components/ui/Header'
import ArchiveWrapper from '@/components/ui/ArchiveWrapper'
import AuthGuard from '@/components/guards/AuthGuard'
import Footer from '@/components/ui/Footer'
import styles from './layout.module.css'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className={styles.shell}>
        <Header />
        <div className={styles.page}>
          <ArchiveWrapper>{children}</ArchiveWrapper>
        </div>
        <Footer />
      </div>
    </AuthGuard>
  )
}
