import type { AppConfig } from '../../config.js'
import type { ProductCandidate } from '../../types.js'
import { logger } from '../../utils/logger.js'
import type { AmazonProvider, AmazonSearchOptions } from './amazon.types.js'
import { FileBackedAmazonProvider } from './fileBackedAmazonProvider.js'
import { MockAmazonClient } from './mockAmazonClient.js'

class PaApiAmazonClient implements AmazonProvider {
  readonly name = 'paapi'

  constructor(private readonly _cfg: AppConfig) {
    const missing: string[] = []
    if (!_cfg.AMAZON_ACCESS_KEY) missing.push('AMAZON_ACCESS_KEY')
    if (!_cfg.AMAZON_SECRET_KEY) missing.push('AMAZON_SECRET_KEY')
    if (missing.length > 0) {
      throw new Error(
        `Amazon PA-API requires ${missing.join(', ')}. ` +
          'Set them in .env, or use `npm start -- --mock` (fixtures) or `npm start -- --manual` (Playwright collector).',
      )
    }
  }

  async search(_opts: AmazonSearchOptions): Promise<ProductCandidate[]> {
    // Real PA-API 5 integration goes here. Use SigV4 against
    // `webservices.<marketplace>/paapi5/searchitems` with SearchItems request.
    // Keep payload typed via amazon.types, never log raw secrets.
    throw new Error(
      'PA-API client not yet implemented. Use `npm start -- --mock` or `npm start -- --manual` until amazonClient.ts is wired up.',
    )
  }
}

export function createAmazonClient(cfg: AppConfig): AmazonProvider {
  if (cfg.AMAZON_PROVIDER === 'paapi') {
    logger.info('Using PA-API Amazon provider')
    return new PaApiAmazonClient(cfg)
  }
  if (cfg.AMAZON_PROVIDER === 'playwright') {
    logger.info(
      'Using file-backed Amazon provider (reads data/candidates.json). ' +
        'Run `npm run collect` first to populate it.',
    )
    return new FileBackedAmazonProvider()
  }
  logger.info('Using mock Amazon provider (no real API calls)')
  return new MockAmazonClient(cfg.AMAZON_ASSOCIATE_TAG, cfg.AMAZON_MARKETPLACE)
}
