'use client'

import Header from '@/components/ui/Header'
import ArchiveWrapper from '@/components/ui/ArchiveWrapper'
import AuthGuard from '@/components/guards/AuthGuard'
import PageTransition from '@/components/ui/PageTransition'
import Footer from '@/components/ui/Footer'
import styles from './layout.module.css'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className={styles.shell}>
        <Header />
        <main className={styles.page}>
          <PageTransition>
            <ArchiveWrapper>{children}</ArchiveWrapper>
          </PageTransition>
        </main>
        <Footer />
      </div>
    </AuthGuard>
  )
}
