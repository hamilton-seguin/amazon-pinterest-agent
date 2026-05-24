import type { Category, ProductCandidate } from '../../types.js';

export interface CopyInput {
  product: ProductCandidate;
  category: Category;
}

export interface CopyOutput {
  pinTitle: string;
  pinDescription: string;
}

export interface CopyProvider {
  name: string;
  generate(input: CopyInput): Promise<CopyOutput>;
}

const SYSTEM_PROMPT = `You write Pinterest Pin copy for affiliate products.
Rules:
- pinTitle: <= 95 chars, descriptive, no emoji spam, no ALL CAPS.
- pinDescription: 2-4 sentences. Structure: benefit/problem + who it's for + specific use case + soft CTA.
- Do NOT mention exact prices.
- Do NOT use words: guaranteed, miracle, cure, cures, official, "100% effective", "FDA approved".
- Do NOT make medical claims.
- Do NOT copy Amazon's description verbatim.
- End the description with the literal disclosure: "Affiliate link — I may earn a commission <3"
Return strict JSON: {"pinTitle": "...", "pinDescription": "..."}.`;

export class AnthropicCopyProvider implements CopyProvider {
  readonly name = 'anthropic';

  constructor(private readonly apiKey: string) {}

  async generate(input: CopyInput): Promise<CopyOutput> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}`);
    }
    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = json.content.find((c) => c.type === 'text')?.text ?? '';
    return parseJsonCopy(text);
  }
}

export class OpenAiCopyProvider implements CopyProvider {
  readonly name = 'openai';

  constructor(private readonly apiKey: string) {}

  async generate(input: CopyInput): Promise<CopyOutput> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(input) },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API ${res.status}`);
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return parseJsonCopy(json.choices[0]?.message.content ?? '');
  }
}

function buildUserPrompt(input: CopyInput): string {
  const { product, category } = input;
  return [
    `Category: ${category}`,
    `Product title: ${product.title}`,
    product.rating !== undefined ? `Rating: ${product.rating}` : null,
    product.reviewCount !== undefined ? `Reviews: ${product.reviewCount}` : null,
    'Write Pinterest copy as instructed. Return JSON only.',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseJsonCopy(text: string): CopyOutput {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI copy response missing JSON');
  const obj = JSON.parse(match[0]) as Partial<CopyOutput>;
  if (!obj.pinTitle || !obj.pinDescription) {
    throw new Error('AI copy missing required fields');
  }
  return { pinTitle: obj.pinTitle, pinDescription: obj.pinDescription };
}
