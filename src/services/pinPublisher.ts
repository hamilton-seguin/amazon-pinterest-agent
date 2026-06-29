import type { AppConfig } from '../config.js'
import {
  PinterestClient,
  PinterestTransientError,
} from '../providers/pinterest/pinterestClient.js'
import { stores } from '../storage/jsonStore.js'
import type { PinDraft } from '../types.js'
import { logger } from '../utils/logger.js'

export interface PublishSummary {
  attempted: number
  publishedCount: number
  failedCount: number
  deferredCount: number
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
      deferredCount: 0,
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

  let client: PinterestClient | null = null
  let boardId = ''
  if (!cfg.DRY_RUN) {
    if (!cfg.PINTEREST_ACCESS_TOKEN?.trim()) {
      throw new Error('PINTEREST_ACCESS_TOKEN required when DRY_RUN=false')
    }
    if (!cfg.PINTEREST_BOARD_ID?.trim()) {
      throw new Error('PINTEREST_BOARD_ID required when DRY_RUN=false')
    }
    client = new PinterestClient(cfg.PINTEREST_ACCESS_TOKEN)
    boardId = cfg.PINTEREST_BOARD_ID
  }

  let publishedCount = 0
  let failedCount = 0
  let deferredCount = 0

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
      // Persist status flip per-iteration so a mid-loop crash doesn't leave
      // approved.json out of sync with published.json.
      await stores.approved.update((rows) =>
        replaceByAsin(rows, publishedDraft),
      )
      publishedCount += 1
      logger.info('Published pin', { asin: draft.asin, pinId: result.pinId })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      // Transient errors (429, 5xx, network) stay 'approved' so the next run
      // retries with backoff. Only terminal errors flip to 'failed'.
      if (err instanceof PinterestTransientError) {
        deferredCount += 1
        logger.warn('Publish deferred (transient)', {
          asin: draft.asin,
          reason,
        })
        // Stop the loop on rate-limit so we don't burn through quota.
        if (err.status === 429) {
          logger.warn('Rate-limited by Pinterest; stopping batch', {
            retryAfter: err.retryAfterSeconds,
          })
          break
        }
        continue
      }
      const failedDraft: PinDraft = {
        ...draft,
        status: 'failed',
        failureReason: reason,
      }
      await stores.approved.update((rows) => replaceByAsin(rows, failedDraft))
      failedCount += 1
      logger.error('Publish failed', { asin: draft.asin, reason })
    }
  }

  return {
    attempted: fresh.length,
    publishedCount,
    failedCount,
    deferredCount,
    dryRun: cfg.DRY_RUN,
  }
}

function replaceByAsin(list: PinDraft[], next: PinDraft): PinDraft[] {
  const idx = list.findIndex((d) => d.asin === next.asin)
  if (idx < 0) return list
  const out = [...list]
  out[idx] = next
  return out
}
