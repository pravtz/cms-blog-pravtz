'use client'

import { useRouter, usePathname } from 'next/navigation'
import type { Category, Tag } from '@/lib/api'
import styles from './FilterBar.module.css'

interface ActiveFilters {
  q?: string
  category?: string
  tag?: string
  year?: string
  month?: string
}

interface FilterBarProps {
  categories: Category[]
  tags: Tag[]
  activeFilters: ActiveFilters
}

const MONTHS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

function getYearOptions(): string[] {
  const current = new Date().getFullYear()
  const years: string[] = []
  for (let y = current; y >= current - 5; y--) {
    years.push(String(y))
  }
  return years
}

export default function FilterBar({ categories, tags, activeFilters }: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams()
    // preserve existing filters
    if (activeFilters.q) params.set('q', activeFilters.q)
    if (activeFilters.category) params.set('category', activeFilters.category)
    if (activeFilters.tag) params.set('tag', activeFilters.tag)
    if (activeFilters.year) params.set('year', activeFilters.year)
    if (activeFilters.month) params.set('month', activeFilters.month)

    if (value === null || value === '') {
      params.delete(key)
      // if clearing year, also clear month
      if (key === 'year') params.delete('month')
    } else {
      params.set(key, value)
      // if changing year, clear month
      if (key === 'year') params.delete('month')
    }

    // always reset to page 1 when filters change
    params.delete('page')

    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const clearAll = () => {
    router.push(pathname)
  }

  const hasActiveFilters =
    !!(activeFilters.q || activeFilters.category || activeFilters.tag || activeFilters.year || activeFilters.month)

  const activeCategoryLabel = categories.find((c) => c.slug === activeFilters.category)?.name
  const activeTagLabel = tags.find((t) => t.slug === activeFilters.tag)?.name
  const activeMonthLabel = MONTHS.find((m) => m.value === activeFilters.month)?.label

  return (
    <div className={styles.wrapper}>
      <div className={styles.filters}>
        {/* Category dropdown */}
        <div className={styles.filterGroup}>
          <label htmlFor="filter-category" className={styles.label}>Categoria</label>
          <select
            id="filter-category"
            className={`${styles.select} ${activeFilters.category ? styles.active : ''}`}
            value={activeFilters.category ?? ''}
            onChange={(e) => updateFilter('category', e.target.value || null)}
          >
            <option value="">Todas as categorias</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name} ({cat.post_count})
              </option>
            ))}
          </select>
        </div>

        {/* Tag multi-select (single for now, listed as scrollable) */}
        <div className={styles.filterGroup}>
          <label htmlFor="filter-tag" className={styles.label}>Tag</label>
          <select
            id="filter-tag"
            className={`${styles.select} ${activeFilters.tag ? styles.active : ''}`}
            value={activeFilters.tag ?? ''}
            onChange={(e) => updateFilter('tag', e.target.value || null)}
          >
            <option value="">Todas as tags</option>
            {tags.map((tag) => (
              <option key={tag.slug} value={tag.slug}>
                {tag.name} ({tag.post_count})
              </option>
            ))}
          </select>
        </div>

        {/* Year filter */}
        <div className={styles.filterGroup}>
          <label htmlFor="filter-year" className={styles.label}>Ano</label>
          <select
            id="filter-year"
            className={`${styles.select} ${activeFilters.year ? styles.active : ''}`}
            value={activeFilters.year ?? ''}
            onChange={(e) => updateFilter('year', e.target.value || null)}
          >
            <option value="">Todos os anos</option>
            {getYearOptions().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Month filter (only when year is selected) */}
        {activeFilters.year && (
          <div className={styles.filterGroup}>
            <label htmlFor="filter-month" className={styles.label}>Mês</label>
            <select
              id="filter-month"
              className={`${styles.select} ${activeFilters.month ? styles.active : ''}`}
              value={activeFilters.month ?? ''}
              onChange={(e) => updateFilter('month', e.target.value || null)}
            >
              <option value="">Todos os meses</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className={styles.chips} role="list" aria-label="Filtros ativos">
          {activeFilters.q && (
            <span className={styles.chip} role="listitem">
              Busca: &ldquo;{activeFilters.q}&rdquo;
              <button
                className={styles.chipRemove}
                onClick={() => updateFilter('q', null)}
                aria-label={`Remover filtro de busca "${activeFilters.q}"`}
              >
                ×
              </button>
            </span>
          )}
          {activeFilters.category && activeCategoryLabel && (
            <span className={styles.chip} role="listitem">
              {activeCategoryLabel}
              <button
                className={styles.chipRemove}
                onClick={() => updateFilter('category', null)}
                aria-label={`Remover filtro de categoria ${activeCategoryLabel}`}
              >
                ×
              </button>
            </span>
          )}
          {activeFilters.tag && activeTagLabel && (
            <span className={styles.chip} role="listitem">
              #{activeTagLabel}
              <button
                className={styles.chipRemove}
                onClick={() => updateFilter('tag', null)}
                aria-label={`Remover filtro de tag ${activeTagLabel}`}
              >
                ×
              </button>
            </span>
          )}
          {activeFilters.year && (
            <span className={styles.chip} role="listitem">
              {activeFilters.year}
              {activeFilters.month && activeMonthLabel && ` / ${activeMonthLabel}`}
              <button
                className={styles.chipRemove}
                onClick={() => updateFilter('year', null)}
                aria-label="Remover filtro de data"
              >
                ×
              </button>
            </span>
          )}
          <button className={styles.clearAll} onClick={clearAll}>
            Limpar todos
          </button>
        </div>
      )}
    </div>
  )
}
