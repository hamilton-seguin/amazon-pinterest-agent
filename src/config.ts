import 'dotenv/config'
import { z } from 'zod'

const boolish = z.union([z.string(), z.boolean()]).transform((v) => {
  if (typeof v === 'boolean') return v
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase())
})

const baseSchema = z.object({
  AMAZON_PROVIDER: z.enum(['mock', 'paapi', 'playwright']).default('mock'),
  COPY_PROVIDER: z
    .enum(['template', 'anthropic', 'openai'])
    .default('template'),
  DRY_RUN: boolish.default('true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  AMAZON_ACCESS_KEY: z.string().optional(),
  AMAZON_SECRET_KEY: z.string().optional(),
  AMAZON_ASSOCIATE_TAG: z
    .string()
    .min(1, 'AMAZON_ASSOCIATE_TAG required for affiliate links'),
  AMAZON_MARKETPLACE: z.string().default('www.amazon.fr'),

  PINTEREST_ACCESS_TOKEN: z.string().optional(),
  PINTEREST_BOARD_ID: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),

  PLAYWRIGHT_HEADLESS: boolish.default('false'),
  AMAZON_BESTSELLER_MAX_PRODUCTS: z.coerce
    .number()
    .int()
    .positive()
    .default(10),
  AMAZON_BESTSELLER_MAX_PER_CATEGORY: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
})

export type AppConfig = z.infer<typeof baseSchema> & {
  isLivePublish: boolean
}

function requireForLive(cfg: z.infer<typeof baseSchema>): void {
  if (cfg.DRY_RUN) return
  const missing: string[] = []
  if (!cfg.PINTEREST_ACCESS_TOKEN) missing.push('PINTEREST_ACCESS_TOKEN')
  if (!cfg.PINTEREST_BOARD_ID) missing.push('PINTEREST_BOARD_ID')
  if (cfg.AMAZON_PROVIDER === 'paapi') {
    if (!cfg.AMAZON_ACCESS_KEY) missing.push('AMAZON_ACCESS_KEY')
    if (!cfg.AMAZON_SECRET_KEY) missing.push('AMAZON_SECRET_KEY')
  }
  if (cfg.COPY_PROVIDER === 'anthropic' && !cfg.ANTHROPIC_API_KEY) {
    missing.push('ANTHROPIC_API_KEY')
  }
  if (cfg.COPY_PROVIDER === 'openai' && !cfg.OPENAI_API_KEY) {
    missing.push('OPENAI_API_KEY')
  }
  if (missing.length > 0) {
    throw new Error(
      `DRY_RUN=false but missing env vars: ${missing.join(', ')}. ` +
        'Set them in .env or re-enable DRY_RUN=true.',
    )
  }
}

let cached: AppConfig | null = null

export function loadConfig(): AppConfig {
  if (cached) return cached
  const parsed = baseSchema.safeParse(process.env)
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${summary}`)
  }
  requireForLive(parsed.data)
  cached = { ...parsed.data, isLivePublish: !parsed.data.DRY_RUN }
  return cached
}
