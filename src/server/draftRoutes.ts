import type { IncomingMessage, ServerResponse } from 'node:http';
import { approveDraft, getDrafts, skipDraft, updateDraft } from '../api/drafts.js';
import type { PinStatus } from '../types.js';

type Handler = (req: IncomingMessage, res: ServerResponse, params: RouteParams) => Promise<void>;

interface RouteParams {
  asin?: string;
  query: URLSearchParams;
}

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
  paramNames: string[];
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

const VALID_STATUSES: PinStatus[] = ['drafted', 'approved', 'published', 'skipped', 'failed'];

function parseStatus(query: URLSearchParams): PinStatus | undefined {
  const s = query.get('status');
  if (!s) return undefined;
  if (!VALID_STATUSES.includes(s as PinStatus)) {
    throw new Error(`Invalid status: ${s}`);
  }
  return s as PinStatus;
}

const routes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/drafts\/?$/,
    paramNames: [],
    handler: async (_req, res, { query }) => {
      const status = parseStatus(query);
      const drafts = await getDrafts(status);
      json(res, 200, drafts);
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/drafts\/([A-Za-z0-9]+)\/?$/,
    paramNames: ['asin'],
    handler: async (req, res, { asin }) => {
      const body = (await readJsonBody(req)) as
        | { pinTitle?: unknown; pinDescription?: unknown }
        | undefined;
      const updates: { pinTitle?: string; pinDescription?: string } = {};
      if (body && typeof body === 'object') {
        if (typeof body.pinTitle === 'string') updates.pinTitle = body.pinTitle;
        if (typeof body.pinDescription === 'string') updates.pinDescription = body.pinDescription;
      }
      const next = await updateDraft(asin!, updates);
      json(res, 200, next);
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/drafts\/([A-Za-z0-9]+)\/approve\/?$/,
    paramNames: ['asin'],
    handler: async (req, res, { asin }) => {
      const body = (await readJsonBody(req)) as
        | { pinTitle?: unknown; pinDescription?: unknown }
        | undefined;
      const updates: { pinTitle?: string; pinDescription?: string } = {};
      if (body && typeof body === 'object') {
        if (typeof body.pinTitle === 'string') updates.pinTitle = body.pinTitle;
        if (typeof body.pinDescription === 'string') updates.pinDescription = body.pinDescription;
      }
      const next = await approveDraft(
        asin!,
        Object.keys(updates).length > 0 ? updates : undefined,
      );
      json(res, 200, next);
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/drafts\/([A-Za-z0-9]+)\/skip\/?$/,
    paramNames: ['asin'],
    handler: async (_req, res, { asin }) => {
      const next = await skipDraft(asin!);
      json(res, 200, next);
    },
  },
];

export async function handleDraftRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return false;

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = url.pathname.match(route.pattern);
    if (!match) continue;
    const params: RouteParams = { query: url.searchParams };
    route.paramNames.forEach((name, i) => {
      (params as unknown as Record<string, unknown>)[name] = match[i + 1];
    });
    try {
      await route.handler(req, res, params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = /not found/i.test(msg) ? 404 : 400;
      json(res, status, { error: msg });
    }
    return true;
  }

  json(res, 404, { error: `No route: ${req.method} ${url.pathname}` });
  return true;
}
