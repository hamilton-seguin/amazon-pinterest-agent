import { describe, expect, it } from 'vitest'
import {
  rankAndKeepTop,
  scoreProduct,
} from '../../src/services/productScoring.js'
import { makeCandidate } from '../fixtures/products.js'

describe('scoreProduct', () => {
  it('returns a score between 0 and 100', () => {
    const { score } = scoreProduct(makeCandidate())
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
    expect(Number.isFinite(score)).toBe(true)
  })

  it('ranks stronger products above weaker ones', () => {
    const strong = makeCandidate({
      asin: 'B000STRONG1',
      title:
        'LED Aesthetic Travel Packing Cubes Organizer Set — Carry-On Storage',
      rating: 4.8,
      reviewCount: 30000,
      price: '$22.00',
    })
    const weak = makeCandidate({
      asin: 'B000WEAK001',
      title: 'Generic Item',
      rating: 4.0,
      reviewCount: 60,
      price: '$120.00',
    })
    const a = scoreProduct(strong).score
    const b = scoreProduct(weak).score
    expect(a).toBeGreaterThan(b)
  })

  it('does not crash when optional fields are missing', () => {
    const bare = makeCandidate({
      asin: 'B000BARE001',
      title: 'Travel Organizer',
      price: undefined,
      rating: undefined,
      reviewCount: undefined,
      bestsellerRank: undefined,
    } as unknown as Parameters<typeof makeCandidate>[0])
    const { score, breakdown } = scoreProduct(bare)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(breakdown.giftability).toBeGreaterThanOrEqual(0)
  })

  it('rankAndKeepTop returns top N sorted by score desc', () => {
    const items = [
      makeCandidate({ asin: 'B000A00001', title: 'plain', reviewCount: 50 }),
      makeCandidate({
        asin: 'B000B00001',
        title: 'LED packing cube travel set',
        reviewCount: 25000,
        rating: 4.7,
        price: '$20',
      }),
      makeCandidate({
        asin: 'B000C00001',
        title: 'travel organizer charger portable',
        reviewCount: 5000,
        rating: 4.5,
        price: '$28',
      }),
    ]
    const top = rankAndKeepTop(items, 2)
    expect(top).toHaveLength(2)
    expect(top[0]!.score).toBeGreaterThanOrEqual(top[1]!.score)
    expect(top[0]!.product.asin).toBe('B000B00001')
  })
})
