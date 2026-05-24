import type { AppConfig } from '../config.js'
import { PinterestClient } from '../providers/pinterest/pinterestClient.js'
import { stores } from '../storage/jsonStore.js'
import type { PinDraft } from '../types.js'
import { logger } from '../utils/logger.js'

export interface PublishSummary {
  attempted: number
  publishedCount: number
  failedCount: number
  dryRun: boolean
}

export async function publishApproved(cfg: AppConfig): Promise<PublishSummary> {
  const approved = await stores.approved.read()
  const pending = approved.filter((d) => d.status === 'approved')
  if (pending.length === 0) {
    logger.info('No approved drafts to publish.')
    return {
      attempted: 0,
      publishedCount: 0,
      failedCount: 0,
      dryRun: cfg.DRY_RUN,
    }
  }

  const published = await stores.published.read()
  const publishedAsins = new Set(published.map((d) => d.asin))
  const fresh = pending.filter((d) => !publishedAsins.has(d.asin))
  const duplicates = pending.length - fresh.length
  if (duplicates > 0) {
    logger.warn('Skipping already-published ASINs', { duplicates })
  }

  const client = cfg.DRY_RUN
    ? null
    : new PinterestClient(cfg.PINTEREST_ACCESS_TOKEN!)
  const boardId = cfg.PINTEREST_BOARD_ID ?? ''

  let publishedCount = 0
  let failedCount = 0
  const updatedApproved = [...approved]

  for (const draft of fresh) {
    if (cfg.DRY_RUN) {
      logger.info('DRY_RUN: would publish pin', {
        asin: draft.asin,
        title: draft.pinTitle,
        link: draft.affiliateUrl,
      })
      continue
    }
    try {
      const result = await client!.createPin({
        boardId,
        title: draft.pinTitle,
        description: draft.pinDescription,
        link: draft.affiliateUrl,
        imageUrl: draft.imageUrl,
      })
      const publishedDraft: PinDraft = {
        ...draft,
        status: 'published',
        publishedAt: new Date().toISOString(),
        pinterestPinId: result.pinId,
      }
      await stores.published.upsert(publishedDraft, (d) => d.asin)
      replaceInPlace(updatedApproved, publishedDraft)
      publishedCount += 1
      logger.info('Published pin', { asin: draft.asin, pinId: result.pinId })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      const failedDraft: PinDraft = {
        ...draft,
        status: 'failed',
        failureReason: reason,
      }
      replaceInPlace(updatedApproved, failedDraft)
      failedCount += 1
      logger.error('Publish failed', { asin: draft.asin, reason })
    }
  }

  if (!cfg.DRY_RUN) {
    await stores.approved.writeAll(updatedApproved)
  }

  return {
    attempted: fresh.length,
    publishedCount,
    failedCount,
    dryRun: cfg.DRY_RUN,
  }
}

function replaceInPlace(list: PinDraft[], next: PinDraft): void {
  const idx = list.findIndex((d) => d.asin === next.asin)
  if (idx >= 0) list[idx] = next
}
