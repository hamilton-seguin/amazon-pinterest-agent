import { spawn } from 'node:child_process'
import { loadConfig, type AppConfig } from './config.js'
import { generateCandidates } from './cli/generate.js'
import { collectAmazon } from './cli/collectAmazon.js'
import { runReviewQueue } from './services/reviewQueue.js'
import { publishApproved } from './services/pinPublisher.js'
import { stores } from './storage/jsonStore.js'
import { logger, setLogLevel } from './utils/logger.js'
import { maskSecret } from './utils/maskSecret.js'

type Command =
  | 'run'
  | 'collect'
  | 'draft'
  | 'review'
  | 'publish'
  | 'clear'
  | 'help'

type SourceMode = 'api' | 'mock' | 'manual'

function wantsHelp(argv: string[]): boolean {
  return argv
    .slice(2)
    .some((a) => a === '--help' || a === '-h' || a === 'help')
}

function parseCommand(argv: string[]): Command {
  if (wantsHelp(argv)) return 'help'
  const cmd = argv[2]
  switch (cmd) {
    case 'run':
    case 'collect':
    case 'draft':
    case 'review':
    case 'publish':
    case 'clear':
      return cmd
    case undefined:
      return 'run'
    default:
      throw new Error(`Unknown command: ${cmd}`)
  }
}

/**
 * Returns true if the flag is present.
 * Supports both invocation forms:
 *   npm start -- --manual    (npm passes "--manual" after `--`)
 *   npm start --manual       (npm exports npm_config_manual env var)
 */
function hasFlag(name: string): boolean {
  if (process.argv.includes(`--${name}`)) return true
  const envVal = process.env[`npm_config_${name}`]
  return envVal === 'true' || envVal === ''
}

function resolveSourceMode(): SourceMode {
  const manual = hasFlag('manual')
  const mock = hasFlag('mock')
  const api = hasFlag('api')
  const picked = [manual, mock, api].filter(Boolean).length
  if (picked > 1) {
    throw new Error('Pick only one of --manual, --mock, --api.')
  }
  if (manual) return 'manual'
  if (mock) return 'mock'
  return 'api'
}

function printHelp(): void {
  console.log(`amazon-pinterest-agent

Usage:
  npm start [-- <flags>]            Run the default pipeline (= \`run\` command).
  npm run <command> [-- <flags>]    Run a specific subcommand.

About \`--\`:
  npm forwards bare custom flags (e.g. \`npm start --manual\`) to the script
  in npm v7+, but it intercepts reserved flags like \`--help\` and \`--version\`.
  Put \`-- \` before any flag that npm might intercept (notably \`--help\`):
    npm start -- --help       # works
    npm start --help          # npm prints npm's help, never reaches the script

Commands:
  run [--cli] [--manual|--mock|--api]
        Default. Fetch products, build drafts, open the review UI.
        --cli      Use CLI prompts for review and auto-publish (skips UI).
        --manual   Use Playwright collector (no PA-API keys needed).
        --mock     Use mock fixtures.
        (default)  Use Amazon PA-API (requires keys).
  collect
        Playwright scrape into data/candidates.json. No drafting.
        (PA-API and mock modes fetch inline during \`draft\`, no separate collect.)
  draft [--manual|--mock|--api]
        Score + generate drafts. Source picked by flag, same as \`run\`.
  review [--cli]
        Open the review UI (default) or run CLI prompts with --cli.
  publish
        Publish approved drafts to Pinterest (respects DRY_RUN).
  clear
        Empty data/candidates.json and drafted rows in data/drafts.json.
  help  Show this.`)
}

async function runFetchAndDraft(
  cfg: AppConfig,
  mode: SourceMode,
): Promise<void> {
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
}

function launchReviewUi(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let userInterrupted = false
    const onInterrupt = () => {
      userInterrupted = true
    }
    process.once('SIGINT', onInterrupt)
    process.once('SIGTERM', onInterrupt)

    const child = spawn(
      'npx',
      [
        'concurrently',
        '-k',
        '-n',
        'api,web',
        '-c',
        'blue,magenta',
        'npm:dev:api',
        'npm:dev:web',
      ],
      { stdio: 'inherit', shell: false },
    )
    child.on('exit', (code, signal) => {
      process.off('SIGINT', onInterrupt)
      process.off('SIGTERM', onInterrupt)
      if (code === 0) return resolve()
      // null code means the child was killed by a signal. Treat as success
      // only when the user explicitly interrupted (Ctrl-C / SIGTERM).
      if (code === null && userInterrupted) return resolve()
      const reason = signal ?? `code ${code}`
      reject(new Error(`Review UI exited (${reason})`))
    })
    child.on('error', reject)
  })
}

async function runCliReview(cfg: AppConfig): Promise<void> {
  const summary = await runReviewQueue()
  logger.info('Review complete', {
    approved: summary.approved.length,
    skipped: summary.skipped.length,
    remaining: summary.remaining.length,
  })
  const result = await publishApproved(cfg)
  logger.info('Publish summary', { ...result })
}

async function runPipeline(cfg: AppConfig): Promise<void> {
  const mode = resolveSourceMode()
  const cli = hasFlag('cli')
  logger.info('Pipeline starting', { mode, reviewer: cli ? 'cli' : 'ui' })
  await runFetchAndDraft(cfg, mode)
  if (cli) {
    await runCliReview(cfg)
    return
  }
  logger.info('Drafts ready. Launching review UI…')
  await launchReviewUi()
}

async function runReview(cfg: AppConfig): Promise<void> {
  if (hasFlag('cli')) {
    await runCliReview(cfg)
    return
  }
  logger.info('Launching review UI…')
  await launchReviewUi()
}

async function runClear(): Promise<void> {
  const candidatesBefore = await stores.candidates.read()
  await stores.candidates.writeAll([])
  const drafts = await stores.drafts.read()
  const keptDrafts = drafts.filter((d) => d.status !== 'drafted')
  const removedDrafts = drafts.length - keptDrafts.length
  await stores.drafts.writeAll(keptDrafts)
  logger.info('Cleared candidates + drafted rows', {
    candidatesRemoved: candidatesBefore.length,
    draftsRemoved: removedDrafts,
    draftsKept: keptDrafts.length,
  })
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
    pinterestToken: maskSecret(cfg.PINTEREST_ACCESS_TOKEN),
  })

  switch (command) {
    case 'run':
      await runPipeline(cfg)
      return
    case 'collect':
      cfg.AMAZON_PROVIDER = 'playwright'
      await collectAmazon(cfg)
      return
    case 'draft': {
      const mode = resolveSourceMode()
      if (mode === 'manual') cfg.AMAZON_PROVIDER = 'playwright'
      else if (mode === 'mock') cfg.AMAZON_PROVIDER = 'mock'
      else cfg.AMAZON_PROVIDER = 'paapi'
      await generateCandidates(cfg)
      return
    }
    case 'review':
      await runReview(cfg)
      return
    case 'publish': {
      const result = await publishApproved(cfg)
      logger.info('Publish summary', { ...result })
      return
    }
    case 'clear':
      await runClear()
      return
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  logger.error('Fatal error', { message: msg })
  process.exitCode = 1
})
