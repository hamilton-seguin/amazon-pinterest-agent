import type { PinDraft, ProductCandidate } from '../../src/types.js'

export function makeCandidate(
  overrides: Partial<ProductCandidate> = {},
): ProductCandidate {
  return {
    asin: 'B000000001',
    title: '8-Piece Compression Packing Cubes Set for Carry-On Luggage',
    imageUrl: 'https://example.test/img/packing-cubes.jpg',
    productUrl: 'https://www.amazon.com/dp/B000000001',
    affiliateUrl: 'https://www.amazon.fr/dp/B000000001?tag=test-21',
    category: 'travel',
    price: '$29.99',
    rating: 4.6,
    reviewCount: 12000,
    bestsellerRank: 12,
    fetchedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeDraft(overrides: Partial<PinDraft> = {}): PinDraft {
  return {
    asin: 'B000000001',
    pinTitle: 'Packing Cubes',
    pinDescription:
      'Tidy travel essentials. Affiliate link — I may earn a commission <3',
    imageUrl: 'https://example.test/img/packing-cubes.jpg',
    affiliateUrl: 'https://www.amazon.fr/dp/B000000001?tag=test-21',
    category: 'travel',
    score: 50,
    status: 'drafted',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}
