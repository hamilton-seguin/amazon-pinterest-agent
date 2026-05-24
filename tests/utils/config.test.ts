import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('dotenv/config', () => ({}))

const KEYS = [
  'AMAZON_PROVIDER',
  'COPY_PROVIDER',
  'DRY_RUN',
  'LOG_LEVEL',
  'AMAZON_ACCESS_KEY',
  'AMAZON_SECRET_KEY',
  'AMAZON_ASSOCIATE_TAG',
  'AMAZON_MARKETPLACE',
  'PINTEREST_ACCESS_TOKEN',
  'PINTEREST_BOARD_ID',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
] as const

let snapshot: Record<string, string | undefined>

beforeEach(() => {
  snapshot = {}
  for (const k of KEYS) snapshot[k] = process.env[k]
  for (const k of KEYS) delete process.env[k]
  vi.resetModules()
})

afterEach(() => {
  for (const k of KEYS) {
    const v = snapshot[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  vi.resetModules()
})

async function loadFresh(): Promise<typeof import('../../src/config.js')> {
  vi.resetModules()
  return await import('../../src/config.js')
}

describe('loadConfig', () => {
  it('throws when AMAZON_ASSOCIATE_TAG is missing', async () => {
    const { loadConfig } = await loadFresh()
    expect(() => loadConfig()).toThrow(/AMAZON_ASSOCIATE_TAG/)
  })

  it('returns sane defaults with only AMAZON_ASSOCIATE_TAG set', async () => {
    process.env.AMAZON_ASSOCIATE_TAG = 'mytag-21'
    const { loadConfig } = await loadFresh()
    const cfg = loadConfig()
    expect(cfg.AMAZON_PROVIDER).toBe('mock')
    expect(cfg.COPY_PROVIDER).toBe('template')
    expect(cfg.DRY_RUN).toBe(true)
    expect(cfg.isLivePublish).toBe(false)
  })

  it('requires Pinterest credentials when DRY_RUN=false', async () => {
    process.env.AMAZON_ASSOCIATE_TAG = 'mytag-21'
    process.env.DRY_RUN = 'false'
    const { loadConfig } = await loadFresh()
    expect(() => loadConfig()).toThrow(/PINTEREST_ACCESS_TOKEN/)
  })

  it('requires AI key when COPY_PROVIDER=openai and DRY_RUN=false', async () => {
    process.env.AMAZON_ASSOCIATE_TAG = 'mytag-21'
    process.env.DRY_RUN = 'false'
    process.env.COPY_PROVIDER = 'openai'
    process.env.PINTEREST_ACCESS_TOKEN = 'tok'
    process.env.PINTEREST_BOARD_ID = 'board'
    const { loadConfig } = await loadFresh()
    expect(() => loadConfig()).toThrow(/OPENAI_API_KEY/)
  })

  it('accepts live config when all required vars are present', async () => {
    process.env.AMAZON_ASSOCIATE_TAG = 'mytag-21'
    process.env.DRY_RUN = 'false'
    process.env.PINTEREST_ACCESS_TOKEN = 'tok'
    process.env.PINTEREST_BOARD_ID = 'board'
    const { loadConfig } = await loadFresh()
    const cfg = loadConfig()
    expect(cfg.isLivePublish).toBe(true)
  })
})
