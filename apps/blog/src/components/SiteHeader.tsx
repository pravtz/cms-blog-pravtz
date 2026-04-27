import Link from 'next/link'
import styles from './SiteHeader.module.css'

interface SiteHeaderProps {
  blogName: string
  blogDescription?: string
}

export default function SiteHeader({ blogName, blogDescription }: SiteHeaderProps) {
  return (
    <header className={styles.header} aria-label="Cabeçalho do site">
      <div className={styles.brandBlock}>
        <Link href="/" className={styles.brand}>
          {blogName}
        </Link>
        {blogDescription ? (
          <p className={styles.description}>{blogDescription}</p>
        ) : (
          <p className={styles.description}>
            Blog editorial do Nexus CMS.
          </p>
        )}
      </div>

      <nav className={styles.nav} aria-label="Navegação principal">
        <Link href="/" className={styles.navLink}>
          Início
        </Link>
        <Link href="/blog" className={styles.navLink}>
          Artigos
        </Link>
        <Link href="/privacidade" className={styles.navLink}>
          Privacidade
        </Link>
      </nav>
    </header>
  )
}
