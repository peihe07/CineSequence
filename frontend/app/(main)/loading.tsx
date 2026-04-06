import styles from '../loading.module.css'

export default function MainLoading() {
  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <i className={`ri-loader-4-line ri-spin ${styles.spinner}`} aria-hidden="true" />
        <p className={styles.label}>Loading...</p>
      </div>
    </div>
  )
}
