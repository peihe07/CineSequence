import styles from './loading.module.css'

export default function Loading() {
  return (
    <div className={styles.container}>
      <i className={`ri-dna-line ${styles.spinner}`} />
    </div>
  )
}
