import type { AppConfig } from '../config.js'
import { createAmazonClient } from '../providers/amazon/amazonClient.js'
import { generateCopy } from '../services/copyGenerator.js'
import { filterCandidates } from '../services/productFilter.js'
import { rankAndKeepTop, type Scored } from '../services/productScoring.js'
import { stores } from '../storage/jsonStore.js'
import {
  CATEGORIES,
  type Category,
  type PinDraft,
  type ProductCandidate,
} from '../types.js'
import { logger } from '../utils/logger.js'

const PER_CATEGORY_FETCH = 10
const PER_CATEGORY_KEEP = 3

export async function generateCandidates(cfg: AppConfig): Promise<void> {
  const amazon = createAmazonClient(cfg)

  const published = await stores.published.read()
  const drafts = await stores.drafts.read()
  const seen = new Set<string>([
    ...published.map((p) => p.asin),
    ...drafts.filter((d) => d.status !== 'failed').map((d) => d.asin),
  ])

  const allScored: Scored[] = []
  for (const category of CATEGORIES) {
    const raw = await amazon.search({ category, limit: PER_CATEGORY_FETCH })
    const { kept, rejected } = filterCandidates(raw, seen)
    logger.info('Category fetched', {
      category,
      fetched: raw.length,
      kept: kept.length,
      rejected: rejected.length,
    })
    if (rejected.length > 0) {
      for (const r of rejected) {
        logger.debug('Rejected candidate', {
          asin: r.product.asin,
          reason: r.reason,
        })
      }
    }
    const top = rankAndKeepTop(kept, PER_CATEGORY_KEEP)
    for (const t of top) allScored.push(t)
  }

  if (allScored.length === 0) {
    logger.warn('No candidates survived filter+scoring.')
    return
  }

  const allCandidates: ProductCandidate[] = allScored.map((s) => s.product)
  await stores.candidates.writeAll(allCandidates)

  const newDrafts: PinDraft[] = []
  for (const scored of allScored) {
    const { product } = scored
    const copy = await generateCopy(product, cfg)
    const draft: PinDraft = {
      asin: product.asin,
      pinTitle: copy.pinTitle,
      pinDescription: copy.pinDescription,
      imageUrl: product.imageUrl,
      affiliateUrl: product.affiliateUrl,
      category: product.category,
      score: scored.score,
      status: 'drafted',
      createdAt: new Date().toISOString(),
    }
    newDrafts.push(draft)
  }

  await stores.drafts.update((rows) => {
    const existing = rows.filter((d) => d.status !== 'drafted')
    return [...existing, ...newDrafts]
  })

  logger.info('Drafts generated', {
    totalDrafts: newDrafts.length,
    byCategory: countByCategory(newDrafts),
  })
}

function countByCategory(drafts: PinDraft[]): Record<Category, number> {
  const out: Record<Category, number> = {
    travel: 0,
    fashion: 0,
    beauty: 0,
    baby: 0,
  }
  for (const d of drafts) out[d.category] += 1
  return out
}
