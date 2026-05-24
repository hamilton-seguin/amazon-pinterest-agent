import type { AppConfig } from '../config.js';
import { loadBestSellerSources } from '../providers/amazon/amazonBestSellerUrls.js';
import {
  CaptchaDetectedError,
  collectFromBestSellers,
} from '../providers/amazon/amazonPlaywrightProvider.js';
import { stores } from '../storage/jsonStore.js';
import type { ProductCandidate } from '../types.js';
import { logger } from '../utils/logger.js';

export async function collectAmazon(cfg: AppConfig): Promise<void> {
  const sources = await loadBestSellerSources();
  if (sources.length === 0) {
    logger.warn('No best-seller sources configured. Add data/bestseller-urls.json or edit amazonBestSellerUrls.ts.');
    return;
  }

  const target = cfg.AMAZON_BESTSELLER_MAX_PRODUCTS;
  const perPageCap = 30;
  const perCategoryCap =
    cfg.AMAZON_BESTSELLER_MAX_PER_CATEGORY ??
    Math.max(1, Math.ceil(target / sources.length));

  const [existingCandidates, published] = await Promise.all([
    stores.candidates.read(),
    stores.published.read(),
  ]);
  const publishedAsins = new Set(published.map((p) => p.asin));
  const existingAsins = new Set(existingCandidates.map((c) => c.asin));
  const alreadySeenAsins = new Set<string>([...existingAsins, ...publishedAsins]);

  logger.info('Starting Playwright Amazon collector (temporary fallback)', {
    sources: sources.length,
    target,
    perCategoryCap,
    perPageCap,
    existingCandidates: existingCandidates.length,
    publishedCount: published.length,
    headless: cfg.PLAYWRIGHT_HEADLESS,
    dryRun: cfg.DRY_RUN,
  });

  let collected: ProductCandidate[];
  try {
    collected = await collectFromBestSellers(sources, cfg, {
      totalTarget: target,
      perCategoryCap,
      perPageCap,
      headless: cfg.PLAYWRIGHT_HEADLESS,
      alreadySeenAsins,
    });
  } catch (err) {
    if (err instanceof CaptchaDetectedError) {
      logger.error(
        'Amazon access challenge detected. Stopping collector. ' +
          'Wait a while and try again, or run with PLAYWRIGHT_HEADLESS=false to solve manually.',
        { url: err.url },
      );
      return;
    }
    throw err;
  }

  if (collected.length === 0) {
    logger.warn(
      'Collector returned 0 new candidates. All ranked products may already be in candidates.json/published.json, ' +
        'or selectors need updating. Delete data/candidates.json to restart from scratch.',
    );
    return;
  }

  const merged: ProductCandidate[] = [...existingCandidates, ...collected];
  logger.info('Collection summary', {
    addedThisRun: collected.length,
    target,
    reachedTarget: collected.length >= target,
    totalCandidates: merged.length,
    dryRun: cfg.DRY_RUN,
  });

  await stores.candidates.writeAll(merged);
  logger.info('Wrote data/candidates.json', { rows: merged.length });
}
