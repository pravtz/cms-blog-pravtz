'use client'

import Link from 'next/link'
import { useState } from 'react'
import styles from './LanguageToggle.module.css'

const LANG_META: Record<string, { flag: string; code: string; label: string }> = {
  'pt-BR': { flag: '🇧🇷', code: 'PT', label: 'Português' },
  en: { flag: '🇬🇧', code: 'EN', label: 'English' },
}

interface LanguageToggleProps {
  currentLanguage: string
  translation: { slug: string; language: string } | null
}

export default function LanguageToggle({ currentLanguage, translation }: LanguageToggleProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const current = LANG_META[currentLanguage] ?? { flag: '🌐', code: currentLanguage.toUpperCase(), label: currentLanguage }

  if (translation) {
    const other = LANG_META[translation.language] ?? { flag: '🌐', code: translation.language.toUpperCase(), label: translation.language }
    return (
      <div className={styles.toggle} aria-label="Language toggle">
        <span className={`${styles.langBtn} ${styles.langActive}`} aria-current="true">
          {current.flag} {current.code}
        </span>
        <Link
          href={`/blog/${translation.slug}`}
          className={styles.langBtn}
          title={`Read in ${other.label}`}
          aria-label={`Read this post in ${other.label}`}
        >
          {other.flag} {other.code}
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.toggle} aria-label="Language toggle">
      <button
        type="button"
        className={`${styles.langBtn} ${styles.langActive}`}
        disabled
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-describedby="lang-no-translation"
      >
        {current.flag} {current.code}
      </button>
      {showTooltip && (
        <span id="lang-no-translation" className={styles.tooltip} role="tooltip">
          No translation available
        </span>
      )}
    </div>
  )
}
