import Link from 'next/link'
import styles from './RBACBanner.module.css'

type Visibility = 'allPrivate' | 'groupPrivate' | 'listPrivate'

interface RBACBannerProps {
  visibility: Visibility
}

const MESSAGES: Record<Visibility, string> = {
  allPrivate: 'This content is available to registered members only.',
  groupPrivate: 'This content is restricted to specific group members.',
  listPrivate: 'This content is restricted to members of a private list.',
}

export default function RBACBanner({ visibility }: RBACBannerProps) {
  const message = MESSAGES[visibility]

  return (
    <div className={styles.banner}>
      <div className={styles.icon} aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 className={styles.title}>Members-only content</h2>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <Link href="/login" className={styles.btnPrimary}>
          Log in
        </Link>
        <Link href="/register" className={styles.btnSecondary}>
          Create account
        </Link>
      </div>
    </div>
  )
}
