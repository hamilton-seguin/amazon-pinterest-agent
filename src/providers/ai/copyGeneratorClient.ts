import type { Category, ProductCandidate } from '../../types.js'

export interface CopyInput {
  product: ProductCandidate
  category: Category
}

export interface CopyOutput {
  pinTitle: string
  pinDescription: string
}

export interface CopyProvider {
  name: string
  generate(input: CopyInput): Promise<CopyOutput>
}

const REQUEST_TIMEOUT_MS = 30_000

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929'
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

const SYSTEM_PROMPT = `You write Pinterest Pin copy for affiliate products.
Rules:
- pinTitle: <= 95 chars, descriptive, no emoji spam, no ALL CAPS.
- pinDescription: 2-4 sentences. Structure: benefit/problem + who it's for + specific use case + soft CTA.
- Do NOT mention exact prices.
- Do NOT use words: guaranteed, miracle, cure, cures, "100% effective", "FDA approved".
- Do NOT make medical claims.
- Do NOT copy Amazon's description verbatim.
- End the description with the literal disclosure: "Affiliate link — I may earn a commission <3"
Return strict JSON: {"pinTitle": "...", "pinDescription": "..."}.`

export class AnthropicCopyProvider implements CopyProvider {
  readonly name = 'anthropic'
  private readonly model: string

  constructor(
    private readonly apiKey: string,
    model?: string,
  ) {
    this.model = model && model.trim() ? model : DEFAULT_ANTHROPIC_MODEL
  }

  async generate(input: CopyInput): Promise<CopyOutput> {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      }),
    })
    if (!res.ok) {
      const detail = await safeText(res)
      throw new Error(`Anthropic API ${res.status}: ${truncate(detail, 200)}`)
    }
    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>
    }
    const text = json.content.find((c) => c.type === 'text')?.text ?? ''
    return parseJsonCopy(text)
  }
}

export class OpenAiCopyProvider implements CopyProvider {
  readonly name = 'openai'
  private readonly model: string

  constructor(
    private readonly apiKey: string,
    model?: string,
  ) {
    this.model = model && model.trim() ? model : DEFAULT_OPENAI_MODEL
  }

  async generate(input: CopyInput): Promise<CopyOutput> {
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(input) },
          ],
        }),
      },
    )
    if (!res.ok) {
      const detail = await safeText(res)
      throw new Error(`OpenAI API ${res.status}: ${truncate(detail, 200)}`)
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    return parseJsonCopy(json.choices[0]?.message.content ?? '')
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`AI copy request failed: ${msg}`)
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

function buildUserPrompt(input: CopyInput): string {
  const { product, category } = input
  return [
    `Category: ${category}`,
    `Product title: ${product.title}`,
    product.rating !== undefined ? `Rating: ${product.rating}` : null,
    product.reviewCount !== undefined
      ? `Reviews: ${product.reviewCount}`
      : null,
    'Write Pinterest copy as instructed. Return JSON only.',
  ]
    .filter(Boolean)
    .join('\n')
}

function parseJsonCopy(text: string): CopyOutput {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI copy response missing JSON')
  const obj = JSON.parse(match[0]) as Partial<CopyOutput>
  if (!obj.pinTitle || !obj.pinDescription) {
    throw new Error('AI copy missing required fields')
  }
  return { pinTitle: obj.pinTitle, pinDescription: obj.pinDescription }
}
