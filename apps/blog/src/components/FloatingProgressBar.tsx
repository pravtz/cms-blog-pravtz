'use client'

import { useEffect, useState } from 'react'
import styles from './FloatingProgressBar.module.css'

export default function FloatingProgressBar() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const docEl = document.documentElement
      const scrollTop = docEl.scrollTop || document.body.scrollTop
      const scrollHeight = docEl.scrollHeight - docEl.clientHeight
      if (scrollHeight <= 0) {
        setProgress(0)
        return
      }
      setProgress((scrollTop / scrollHeight) * 100)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={styles.bar}
      style={{ width: `${progress}%` }}
      aria-hidden="true"
      role="presentation"
    />
  )
}
