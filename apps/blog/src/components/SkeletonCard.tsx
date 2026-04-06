import styles from './SkeletonCard.module.css'

export default function SkeletonCard() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.image} />
      <div className={styles.body}>
        <div className={styles.tag} />
        <div className={styles.title} />
        <div className={styles.titleShort} />
        <div className={styles.excerpt} />
        <div className={styles.excerptShort} />
        <div className={styles.footer}>
          <div className={styles.author} />
          <div className={styles.date} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonFeedCard() {
  return (
    <div className={styles.feedCard} aria-hidden="true">
      <div className={styles.feedImage} />
      <div className={styles.feedBody}>
        <div className={styles.tag} />
        <div className={styles.title} />
        <div className={styles.titleShort} />
        <div className={styles.excerpt} />
        <div className={styles.footer}>
          <div className={styles.author} />
          <div className={styles.date} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 6, listLayout = false }: { count?: number; listLayout?: boolean }) {
  if (listLayout) {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <SkeletonFeedCard key={i} />
        ))}
      </>
    )
  }
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  )
}
