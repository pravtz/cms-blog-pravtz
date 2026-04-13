'use client'

import { useState, useEffect, useCallback } from 'react'

export type ThemeName = 'onyx' | 'emerald' | 'crimson' | 'slate' | 'amber' | 'rose' | 'violet'

export const THEMES: { id: ThemeName; label: string; accent: string; bg: string }[] = [
  { id: 'onyx',    label: 'Onyx',    accent: '#8b7cf8', bg: '#0f0f0f' },
  { id: 'emerald', label: 'Emerald', accent: '#34d399', bg: '#0a0f0c' },
  { id: 'crimson', label: 'Crimson', accent: '#f87171', bg: '#0f0a0a' },
  { id: 'slate',   label: 'Slate',   accent: '#7dd3fc', bg: '#0d0f14' },
  { id: 'amber',   label: 'Amber',   accent: '#fbbf24', bg: '#0f0d08' },
  { id: 'rose',    label: 'Rose',    accent: '#fb7185', bg: '#0f090d' },
  { id: 'violet',  label: 'Violet',  accent: '#c4b5fd', bg: '#0c0a10' },
]

const STORAGE_KEY = 'nexus-theme'

function applyTheme(theme: ThemeName) {
  const html = document.documentElement
  if (theme === 'onyx') {
    html.removeAttribute('data-theme')
  } else {
    html.setAttribute('data-theme', theme)
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>('onyx')

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null
    const resolved = stored && THEMES.some((t) => t.id === stored) ? stored : 'onyx'
    setThemeState(resolved)
    applyTheme(resolved)
  }, [])

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next)
    localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
  }, [])

  return { theme, setTheme, themes: THEMES }
}
