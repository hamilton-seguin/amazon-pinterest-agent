import { describe, expect, it } from 'vitest'
import { filterCandidates } from '../../src/services/productFilter.js'
import { makeCandidate } from '../fixtures/products.js'
import { CATEGORIES } from '../../src/types.js'

describe('filterCandidates', () => {
  it('accepts supported categories from CATEGORIES', () => {
    const candidates = CATEGORIES.map((category, i) =>
      makeCandidate({
        category,
        asin: `B000CAT${String(i).padStart(4, '0')}`,
        title: `${category} organizer set`,
      }),
    )
    const { kept, rejected } = filterCandidates(candidates, new Set())
    expect(kept).toHaveLength(CATEGORIES.length)
    expect(rejected).toHaveLength(0)
  })

  it('rejects products already in published history', () => {
    const c = makeCandidate({ asin: 'B000PUB0001' })
    const result = filterCandidates([c], new Set(['B000PUB0001']))
    expect(result.kept).toHaveLength(0)
    expect(result.rejected[0]?.reason).toBe('already-seen')
  })

  it('rejects restricted category keywords in title', () => {
    const supplement = makeCandidate({
      asin: 'B000RST0001',
      title: 'Daily Supplement Vitamin Pack',
    })
    const { kept, rejected } = filterCandidates([supplement], new Set())
    expect(kept).toHaveLength(0)
    expect(rejected[0]?.reason).toMatch(/restricted-category/)
  })

  it('rejects spammy titles', () => {
    const spam = makeCandidate({
      asin: 'B000SPM0001',
      title: 'AMAZING DEAL!!! BEST PRODUCT EVER',
    })
    const { kept, rejected } = filterCandidates([spam], new Set())
    expect(kept).toHaveLength(0)
    expect(rejected[0]?.reason).toBe('spammy-title')
  })

  it('rejects products with too few reviews or low rating', () => {
    const fewReviews = makeCandidate({
      asin: 'B000REV0001',
      reviewCount: 10,
    })
    const lowRating = makeCandidate({ asin: 'B000RAT0001', rating: 3.0 })
    const r1 = filterCandidates([fewReviews], new Set())
    const r2 = filterCandidates([lowRating], new Set())
    expect(r1.rejected[0]?.reason).toBe('too-few-reviews')
    expect(r2.rejected[0]?.reason).toBe('low-rating')
  })

  it('deduplication contract: caller passes seen ASINs and filter excludes them', () => {
    const a = makeCandidate({ asin: 'B000DUP0001' })
    const b = makeCandidate({ asin: 'B000DUP0002' })
    const { kept } = filterCandidates([a, b, a], new Set(['B000DUP0001']))
    const asins = kept.map((k) => k.asin)
    expect(asins).toContain('B000DUP0002')
    expect(asins).not.toContain('B000DUP0001')
  })
})
