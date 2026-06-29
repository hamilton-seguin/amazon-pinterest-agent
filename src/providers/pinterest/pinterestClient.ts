import { logger } from '../../utils/logger.js'
import { maskSecret } from '../../utils/maskSecret.js'
import type { CreatePinRequest, CreatePinResult } from './pinterest.types.js'

const API_BASE = 'https://api.pinterest.com/v5'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000

/**
 * Raised for transient failures (429, 5xx, network) that callers should
 * defer rather than mark as terminally failed.
 */
export class PinterestTransientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'PinterestTransientError'
  }
}

export class PinterestClient {
  constructor(private readonly accessToken: string) {
    if (!accessToken.trim()) {
      throw new Error('PINTEREST_ACCESS_TOKEN required for PinterestClient')
    }
  }

  async createPin(req: CreatePinRequest): Promise<CreatePinResult> {
    if (!req.boardId.trim()) {
      throw new Error('Pinterest createPin: boardId is required')
    }
    const body = {
      board_id: req.boardId,
      title: req.title,
      description: req.description,
      link: req.link,
      media_source: {
        source_type: 'image_url',
        url: req.imageUrl,
      },
    }

    logger.debug('Pinterest createPin', {
      boardId: req.boardId,
      title: req.title,
      tokenMasked: maskSecret(this.accessToken),
    })

    let lastError: Error | undefined
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        return await this.attemptCreate(body)
      } catch (err) {
        lastError = err as Error
        if (!(err instanceof PinterestTransientError)) throw err
        if (attempt === MAX_RETRIES - 1) throw err
        const wait = backoffMs(attempt, err.retryAfterSeconds)
        logger.warn('Pinterest transient failure; retrying', {
          status: err.status,
          attempt: attempt + 1,
          waitMs: wait,
        })
        await sleep(wait)
      }
    }
    throw lastError ?? new Error('Pinterest createPin: unknown failure')
  }

  private async attemptCreate(body: unknown): Promise<CreatePinResult> {
    let res: Response
    try {
      res = await fetch(`${API_BASE}/pins`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (err) {
      // fetch network errors and AbortError both surface here.
      const msg = err instanceof Error ? err.message : String(err)
      throw new PinterestTransientError(`Pinterest network: ${msg}`, 0)
    }

    if (res.ok) {
      const json = (await res.json()) as { id: string }
      if (!json.id) throw new Error('Pinterest API response missing pin id')
      return { pinId: json.id }
    }

    const text = await safeText(res)
    const message = `Pinterest API ${res.status}: ${truncate(text, 300)}`
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = parseRetryAfter(res.headers.get('retry-after'))
      throw new PinterestTransientError(message, res.status, retryAfter)
    }
    throw new Error(message)
  }
}

function backoffMs(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 60_000)
  }
  const jitter = Math.floor(Math.random() * 250)
  return BASE_BACKOFF_MS * 2 ** attempt + jitter
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined
  const n = Number.parseInt(header, 10)
  if (Number.isFinite(n) && n > 0) return n
  // HTTP-date form: convert delta to seconds.
  const t = Date.parse(header)
  if (!Number.isFinite(t)) return undefined
  const delta = Math.ceil((t - Date.now()) / 1000)
  return delta > 0 ? delta : undefined
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return '<unreadable body>'
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`
}
