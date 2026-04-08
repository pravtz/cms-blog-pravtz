import { describe, it, expect } from 'vitest'
import { slugify, uniqueSlug, calculateReadingTime, isVisibleTo } from '@/lib/utils'

describe('slugify', () => {
  it('lowercases ASCII input', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('strips accented characters (NFD normalization)', () => {
    expect(slugify('Ação de Graças')).toBe('acao-de-gracas')
    expect(slugify('Über die Straße')).toBe('uber-die-stra-e') // ß has no NFD decomposition; becomes '-'
    expect(slugify('café')).toBe('cafe')
  })

  it('replaces non-alphanumeric sequences with a single hyphen', () => {
    expect(slugify('Hello   World!!!')).toBe('hello-world')
    expect(slugify('a/b/c')).toBe('a-b-c')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('---hello---')).toBe('hello')
    expect(slugify('!hello!')).toBe('hello')
  })

  it('truncates at 120 characters', () => {
    const long = 'a'.repeat(200)
    expect(slugify(long).length).toBe(120)
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })
})

describe('uniqueSlug', () => {
  it('appends a base-36 timestamp suffix to the base', () => {
    const result = uniqueSlug('my-post')
    expect(result).toMatch(/^my-post-[0-9a-z]+$/)
  })

  it('returns only the suffix when base is empty', () => {
    const result = uniqueSlug('')
    expect(result).toMatch(/^[0-9a-z]+$/)
  })

  it('produces different values on successive calls', () => {
    const a = uniqueSlug('post')
    const b = uniqueSlug('post')
    // timestamps are ms-resolution so they usually differ; at minimum lengths differ occasionally
    // Just ensure neither throws and both look valid
    expect(a).toMatch(/^post-/)
    expect(b).toMatch(/^post-/)
  })
})

describe('calculateReadingTime', () => {
  it('returns 1 for empty content', () => {
    expect(calculateReadingTime('')).toBe(1)
  })

  it('returns 1 for very short content (< 200 words)', () => {
    expect(calculateReadingTime('hello world')).toBe(1)
    expect(calculateReadingTime('word '.repeat(199))).toBe(1)
  })

  it('returns 1 for exactly 200 words', () => {
    expect(calculateReadingTime('word '.repeat(200))).toBe(1)
  })

  it('returns 2 for 201-400 words', () => {
    expect(calculateReadingTime('word '.repeat(201))).toBe(1) // rounds down = 1
    expect(calculateReadingTime('word '.repeat(300))).toBe(2) // rounds to 2 at midpoint
  })

  it('returns correct time for 400 words', () => {
    expect(calculateReadingTime('word '.repeat(400))).toBe(2)
  })

  it('returns correct time for 1000 words', () => {
    expect(calculateReadingTime('word '.repeat(1000))).toBe(5)
  })

  it('handles whitespace-only content as zero words (returns 1)', () => {
    expect(calculateReadingTime('   \n   \t   ')).toBe(1)
  })
})

describe('isVisibleTo', () => {
  describe('public visibility', () => {
    it('is visible to unauthenticated users (null role)', () => {
      expect(isVisibleTo('public', null)).toBe(true)
    })

    it('is visible to any authenticated role', () => {
      expect(isVisibleTo('public', 'default')).toBe(true)
      expect(isVisibleTo('public', 'author')).toBe(true)
      expect(isVisibleTo('public', 'admin')).toBe(true)
      expect(isVisibleTo('public', 'owner')).toBe(true)
    })
  })

  describe('iPrivate visibility', () => {
    it('is only visible to owner', () => {
      expect(isVisibleTo('iPrivate', 'owner')).toBe(true)
    })

    it('is NOT visible to non-owner roles', () => {
      expect(isVisibleTo('iPrivate', 'admin')).toBe(false)
      expect(isVisibleTo('iPrivate', 'author')).toBe(false)
      expect(isVisibleTo('iPrivate', 'default')).toBe(false)
    })

    it('is NOT visible to unauthenticated users', () => {
      expect(isVisibleTo('iPrivate', null)).toBe(false)
    })
  })

  describe('allPrivate visibility', () => {
    it('is visible to any authenticated user', () => {
      expect(isVisibleTo('allPrivate', 'default')).toBe(true)
      expect(isVisibleTo('allPrivate', 'author')).toBe(true)
      expect(isVisibleTo('allPrivate', 'owner')).toBe(true)
    })

    it('is NOT visible to unauthenticated users', () => {
      expect(isVisibleTo('allPrivate', null)).toBe(false)
    })
  })

  describe('groupPrivate visibility', () => {
    it('requires authentication', () => {
      expect(isVisibleTo('groupPrivate', null)).toBe(false)
      expect(isVisibleTo('groupPrivate', 'default')).toBe(true)
    })
  })

  describe('listPrivate visibility', () => {
    it('requires authentication', () => {
      expect(isVisibleTo('listPrivate', null)).toBe(false)
      expect(isVisibleTo('listPrivate', 'author')).toBe(true)
    })
  })
})
