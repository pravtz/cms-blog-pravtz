'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Post } from '@/lib/api'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  initialValue?: string
  onSearch: (q: string) => void
}

interface AutocompleteItem {
  slug: string
  title: string
  category_name: string | null
}

export default function SearchBar({ initialValue = '', onSearch }: SearchBarProps) {
  const [value, setValue] = useState(initialValue)
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  // Focus on `/` key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement !== inputRef.current &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced autocomplete fetch
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/posts?q=${encodeURIComponent(q)}&limit=5`)
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      const items: AutocompleteItem[] = (data.posts as Post[]).map((p) => ({
        slug: p.slug,
        title: p.seo_title || p.title,
        category_name: p.category_name,
      }))
      setSuggestions(items)
      setShowSuggestions(items.length > 0)
      setActiveSuggestion(-1)
    } catch {
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setValue(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 300)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowSuggestions(false)
    onSearch(value.trim())
  }

  const handleSuggestionClick = (item: AutocompleteItem) => {
    setShowSuggestions(false)
    router.push(`/blog/${item.slug}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault()
      handleSuggestionClick(suggestions[activeSuggestion])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setValue('')
      onSearch('')
    }
  }

  const handleClear = () => {
    setValue('')
    setSuggestions([])
    setShowSuggestions(false)
    onSearch('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={styles.wrapper} role="search">
      <form onSubmit={handleSubmit} className={styles.form}>
        <span className={styles.icon} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          placeholder="Buscar artigos… (pressione / para focar)"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          aria-label="Buscar artigos"
          aria-autocomplete="list"
          aria-controls={showSuggestions ? 'search-suggestions' : undefined}
          aria-activedescendant={
            activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined
          }
          autoComplete="off"
          spellCheck="false"
        />
        {loading && (
          <span className={styles.spinner} aria-hidden="true" />
        )}
        {value && !loading && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClear}
            aria-label="Limpar busca"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        {!value && (
          <kbd className={styles.shortcut} aria-hidden="true">/</kbd>
        )}
      </form>

      {showSuggestions && (
        <ul
          id="search-suggestions"
          className={styles.suggestions}
          role="listbox"
          aria-label="Sugestões de busca"
        >
          {suggestions.map((item, i) => (
            <li
              key={item.slug}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === activeSuggestion}
              className={`${styles.suggestion} ${i === activeSuggestion ? styles.active : ''}`}
              onMouseDown={() => handleSuggestionClick(item)}
            >
              <svg className={styles.suggestionIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span className={styles.suggestionTitle}>{item.title}</span>
              {item.category_name && (
                <span className={styles.suggestionCategory}>{item.category_name}</span>
              )}
            </li>
          ))}
          {suggestions.length === 0 && value.length >= 2 && !loading && (
            <li className={styles.empty} role="option" aria-selected="false">
              Nenhum resultado para &ldquo;{value}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
