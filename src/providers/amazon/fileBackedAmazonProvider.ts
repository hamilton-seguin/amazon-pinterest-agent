import { stores } from '../../storage/jsonStore.js';
import type { ProductCandidate } from '../../types.js';
import { logger } from '../../utils/logger.js';
import type { AmazonProvider, AmazonSearchOptions } from './amazon.types.js';

/**
 * Reads pre-collected candidates from data/candidates.json.
 *
 * Used in tandem with the Playwright collector: `collect:amazon` populates
 * the file, then `generate:candidates` (with AMAZON_PROVIDER=playwright)
 * consumes it through the normal scoring/copy/review pipeline.
 */
export class FileBackedAmazonProvider implements AmazonProvider {
  readonly name = 'playwright-file';

  async search(opts: AmazonSearchOptions): Promise<ProductCandidate[]> {
    const all = await stores.candidates.read();
    const matched = all.filter((c) => c.category === opts.category);
    if (matched.length === 0) {
      logger.warn('No candidates in data/candidates.json for category', { category: opts.category });
    }
    return matched.slice(0, opts.limit);
  }
}
