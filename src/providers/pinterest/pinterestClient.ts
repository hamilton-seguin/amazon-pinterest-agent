import { logger } from '../../utils/logger.js'
import { maskSecret } from '../../utils/maskSecret.js'
import type { CreatePinRequest, CreatePinResult } from './pinterest.types.js'

const API_BASE = 'https://api.pinterest.com/v5'

export class PinterestClient {
  constructor(private readonly accessToken: string) {
    if (!accessToken.trim()) {
      throw new Error('PINTEREST_ACCESS_TOKEN required for PinterestClient')
    }
  }

  async createPin(req: CreatePinRequest): Promise<CreatePinResult> {
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

    const res = await fetch(`${API_BASE}/pins`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await safeText(res)
      throw new Error(`Pinterest API ${res.status}: ${truncate(text, 300)}`)
    }
    const json = (await res.json()) as { id: string }
    if (!json.id) throw new Error('Pinterest API response missing pin id')
    return { pinId: json.id }
  }
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
