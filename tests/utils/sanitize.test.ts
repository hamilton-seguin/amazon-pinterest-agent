import { describe, expect, it } from 'vitest'
import {
  AFFILIATE_DISCLOSURE,
  containsRestrictedCategory,
  ensureDisclosure,
  sanitizeCopy,
} from '../../src/utils/sanitize.js'

describe('sanitizeCopy', () => {
  it('passes clean text through unchanged', () => {
    const r = sanitizeCopy('A tidy travel pouch for weekend trips.')
    expect(r.ok).toBe(true)
    expect(r.flagged).toEqual([])
    expect(r.cleaned).toBe('A tidy travel pouch for weekend trips.')
  })

  it('strips banned phrases and reports them', () => {
    const r = sanitizeCopy('This is a miracle cure for tired skin.')
    expect(r.ok).toBe(false)
    expect(r.flagged).toEqual(expect.arrayContaining(['miracle', 'cure']))
    expect(r.cleaned.toLowerCase()).not.toContain('miracle')
    expect(r.cleaned.toLowerCase()).not.toContain('cure')
  })
})

describe('containsRestrictedCategory', () => {
  it('flags restricted terms', () => {
    expect(containsRestrictedCategory('Vape starter kit')).toBe('vape')
    expect(containsRestrictedCategory('Daily supplement gummies')).toBe(
      'supplement',
    )
  })

  it('returns null for safe titles', () => {
    expect(containsRestrictedCategory('Packing cubes for travel')).toBeNull()
  })
})

describe('ensureDisclosure', () => {
  it('appends disclosure when missing', () => {
    const out = ensureDisclosure('Just a regular description.')
    expect(out).toContain(AFFILIATE_DISCLOSURE)
  })

  it('does not duplicate disclosure when already present', () => {
    const input = `Some copy. ${AFFILIATE_DISCLOSURE}`
    const out = ensureDisclosure(input)
    const occurrences = out.toLowerCase().split('affiliate link').length - 1
    expect(occurrences).toBe(1)
  })
})
