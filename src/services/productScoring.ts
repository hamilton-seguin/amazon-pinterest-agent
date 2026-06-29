import type { Category, ProductCandidate } from '../types.js'

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  travel: [
    'packing',
    'cube',
    'toiletry',
    'organizer',
    'luggage',
    'travel',
    'charger',
    'portable',
    'neck pillow',
    'carry-on',
  ],
  fashion: [
    'bag',
    'crossbody',
    'tote',
    'scarf',
    'beanie',
    'hat',
    'jewelry',
    'belt',
    'wallet',
    'sunglasses',
  ],
  beauty: [
    'mirror',
    'organizer',
    'skincare',
    'brush',
    'hair',
    'vanity',
    'led',
    'roller',
    'gua sha',
    'makeup',
  ],
  baby: [
    'nursery',
    'crib',
    'diaper',
    'caddy',
    'organizer',
    'closet',
    'stroller',
    'gift',
    'baby travel',
    'pacifier',
  ],
}

const USE_CASE_HINTS = [
  'for',
  'set of',
  'pack',
  'with',
  'compartment',
  'portable',
  'foldable',
  'travel',
  'organizer',
  'storage',
  'gift',
]

const VISUAL_HINTS = [
  'led',
  'clear',
  'acrylic',
  'rose',
  'matte',
  'velvet',
  'quilted',
  'pastel',
  'minimalist',
  'aesthetic',
  'wood',
  'marble',
]

const GIFTABLE_PRICE_MAX = 50
const TREND_HINTS = ['new', '2025', '2026', 'trending', 'viral', 'tiktok']

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function countHits(haystack: string, needles: string[]): number {
  const lower = haystack.toLowerCase()
  return needles.reduce((n, w) => (lower.includes(w) ? n + 1 : n), 0)
}

/**
 * Parses prices across marketplaces. Handles:
 *   "$29.99", "29.99 €", "29,99 €", "1 299,99 €", "1,299.99 USD", "€1.299,99"
 * Strategy: strip thin/regular/non-breaking spaces, pick the longest digit run
 * including grouping separators, then resolve decimal vs grouping by the
 * position of the last `.` or `,`.
 */
function parsePrice(price: string | undefined): number | null {
  if (!price) return null
  const stripped = price.replace(/[\s  ]/g, '')
  const m = stripped.match(/[\d.,]+/)
  if (!m) return null
  const token = m[0]
  const lastDot = token.lastIndexOf('.')
  const lastComma = token.lastIndexOf(',')
  let normalized: string
  if (lastDot === -1 && lastComma === -1) {
    normalized = token
  } else if (lastComma > lastDot) {
    // comma is the decimal separator: 1.299,99 → 1299.99
    normalized = token.replace(/\./g, '').replace(',', '.')
  } else {
    // dot is the decimal separator: 1,299.99 → 1299.99
    normalized = token.replace(/,/g, '')
  }
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}

export interface Scored {
  product: ProductCandidate
  score: number
  breakdown: Record<string, number>
}

export function scoreProduct(p: ProductCandidate): Scored {
  const titleHits = countHits(p.title, CATEGORY_KEYWORDS[p.category])
  const visualHits = countHits(p.title, VISUAL_HINTS)
  const useCaseHits = countHits(p.title, USE_CASE_HINTS)
  const trendHits = countHits(p.title, TREND_HINTS)

  const breakdown = {
    visualAppeal: clamp(visualHits * 7, 0, 20),
    categoryFit: clamp(titleHits * 6, 0, 20),
    useCase: clamp(useCaseHits * 5, 0, 15),
    socialProof: socialProofScore(p),
    giftability: giftabilityScore(p),
    trend: clamp(trendHits * 4, 0, 10),
  }

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return { product: p, score: clamp(Math.round(total), 0, 100), breakdown }
}

function socialProofScore(p: ProductCandidate): number {
  let s = 0
  if (p.reviewCount !== undefined) {
    if (p.reviewCount >= 10000) s += 15
    else if (p.reviewCount >= 1000) s += 10
    else if (p.reviewCount >= 100) s += 5
  }
  if (p.rating !== undefined) {
    if (p.rating >= 4.6) s += 5
    else if (p.rating >= 4.3) s += 3
  }
  return clamp(s, 0, 20)
}

function giftabilityScore(p: ProductCandidate): number {
  const price = parsePrice(p.price)
  if (price === null) return 5
  if (price <= 25) return 15
  if (price <= GIFTABLE_PRICE_MAX) return 10
  if (price <= 100) return 5
  return 0
}

export function rankAndKeepTop(
  products: ProductCandidate[],
  topN: number,
): Scored[] {
  return products
    .map(scoreProduct)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}
