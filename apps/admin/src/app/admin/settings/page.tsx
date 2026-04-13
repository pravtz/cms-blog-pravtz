'use client'

import { useTheme, THEMES, ThemeName } from '@/lib/useTheme'
import styles from './page.module.css'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className={styles.page}>
      <h1 style={{ fontSize: 'var(--text-h1)', marginBottom: 'var(--space-8)' }}>Settings</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Appearance</h2>
        <p className={styles.sectionDesc}>
          Choose a color theme for the admin panel. Your preference is saved locally.
        </p>

        <div className={styles.themeGrid} role="radiogroup" aria-label="Color theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              className={`${styles.themeCard} ${theme === t.id ? styles.active : ''}`}
              onClick={() => setTheme(t.id as ThemeName)}
            >
              <div
                className={styles.themePreview}
                style={{ background: t.bg }}
                aria-hidden="true"
              >
                <span
                  className={styles.accentDot}
                  style={{ background: t.accent }}
                />
              </div>
              <div className={styles.themeLabel}>
                <span>{t.label}</span>
                {theme === t.id && (
                  <svg
                    className={styles.checkIcon}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
