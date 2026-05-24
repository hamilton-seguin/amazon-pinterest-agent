import { loadConfig, type AppConfig } from './config.js'
import { generateCandidates } from './cli/generate.js'
import { collectAmazon } from './cli/collectAmazon.js'
import { runReviewQueue } from './services/reviewQueue.js'
import { publishApproved } from './services/pinPublisher.js'
import { stores } from './storage/jsonStore.js'
import { logger, setLogLevel } from './utils/logger.js'
import { maskSecret } from './utils/maskSecret.js'

type Command =
  | 'generate:candidates'
  | 'collect:amazon'
  | 'review:candidates'
  | 'publish:approved'
  | 'clear:candidates'
  | 'daily'
  | 'help'

type DailyMode = 'api' | 'mock' | 'manual'

function parseCommand(argv: string[]): Command {
  const cmd = argv[2]
  switch (cmd) {
    case 'generate:candidates':
    case 'collect:amazon':
    case 'review:candidates':
    case 'publish:approved':
    case 'clear:candidates':
    case 'daily':
      return cmd
    case undefined:
    case 'help':
    case '-h':
    case '--help':
      return 'help'
    default:
      throw new Error(`Unknown command: ${cmd}`)
  }
}

/**
 * Returns true if the flag is present.
 * Supports both invocation forms:
 *   npm run daily -- --manual    (npm passes "--manual" after `--`)
 *   npm run daily --manual       (npm exports npm_config_manual env var)
 */
function hasFlag(name: string): boolean {
  if (process.argv.includes(`--${name}`)) return true
  const envVal = process.env[`npm_config_${name}`]
  return envVal === 'true' || envVal === ''
}

function resolveDailyMode(): DailyMode {
  const manual = hasFlag('manual')
  const mock = hasFlag('mock')
  if (manual && mock) {
    throw new Error('Cannot combine --manual and --mock flags. Pick one.')
  }
  if (manual) return 'manual'
  if (mock) return 'mock'
  return 'api'
}

function printHelp(): void {
  console.log(`amazon-pinterest-agent
Commands:
  generate:candidates   Fetch via configured Amazon provider, score, save drafts.
  collect:amazon        Temporary Playwright collector (until PA-API keys arrive).
  review:candidates     Interactively approve/skip/edit drafts.
  publish:approved      Publish approved drafts to Pinterest (respects DRY_RUN).
  clear:candidates      Empty data/candidates.json.
  daily                 Full pipeline (provider → drafts → review → publish).
                        Flags (one or none):
                          --mock     use mock fixtures (no keys needed)
                          --manual   use Playwright collector (no PA-API keys needed)
                          (default)  use Amazon PA-API (requires keys)
  help                  Show this.`)
}

async function runDaily(cfg: AppConfig): Promise<void> {
  const mode = resolveDailyMode()
  logger.info('Daily pipeline mode', { mode })

  switch (mode) {
    case 'manual':
      cfg.AMAZON_PROVIDER = 'playwright'
      await collectAmazon(cfg)
      await generateCandidates(cfg)
      break
    case 'mock':
      cfg.AMAZON_PROVIDER = 'mock'
      await generateCandidates(cfg)
      break
    case 'api':
      cfg.AMAZON_PROVIDER = 'paapi'
      await generateCandidates(cfg)
      break
  }

  const summary = await runReviewQueue()
  logger.info('Review complete', {
    approved: summary.approved.length,
    skipped: summary.skipped.length,
    remaining: summary.remaining.length,
  })

  const result = await publishApproved(cfg)
  logger.info('Publish summary', { ...result })
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv)
  if (command === 'help') {
    printHelp()
    return
  }

  const cfg = loadConfig()
  setLogLevel(cfg.LOG_LEVEL)

  logger.info('Starting amazon-pinterest-agent', {
    command,
    dryRun: cfg.DRY_RUN,
    amazonProvider: cfg.AMAZON_PROVIDER,
    copyProvider: cfg.COPY_PROVIDER,
    associateTag: maskSecret(cfg.AMAZON_ASSOCIATE_TAG),
    pinterestToken: cfg.PINTEREST_ACCESS_TOKEN ?? '',
  })

  if (command === 'daily') {
    await runDaily(cfg)
    return
  }
  if (command === 'collect:amazon') {
    await collectAmazon(cfg)
    return
  }
  if (command === 'generate:candidates') {
    await generateCandidates(cfg)
    return
  }
  if (command === 'review:candidates') {
    const summary = await runReviewQueue()
    logger.info('Review complete', {
      approved: summary.approved.length,
      skipped: summary.skipped.length,
      remaining: summary.remaining.length,
    })
    return
  }
  if (command === 'publish:approved') {
    const result = await publishApproved(cfg)
    logger.info('Publish summary', { ...result })
    return
  }
  if (command === 'clear:candidates') {
    const before = await stores.candidates.read()
    await stores.candidates.writeAll([])
    logger.info('Cleared data/candidates.json', { removed: before.length })
    return
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  logger.error('Fatal error', { message: msg })
  process.exitCode = 1
})
