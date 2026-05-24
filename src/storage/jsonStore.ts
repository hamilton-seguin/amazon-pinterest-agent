import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function dataDir(): string {
  const override = process.env.APP_DATA_DIR
  if (override && override.trim()) return resolve(override)
  return resolve(process.cwd(), 'data')
}

export interface JsonStore<T> {
  readonly path: string
  read(): Promise<T[]>
  writeAll(rows: T[]): Promise<void>
  append(row: T): Promise<void>
  upsert(row: T, keyOf: (r: T) => string): Promise<void>
}

export function jsonStore<T>(fileName: string): JsonStore<T> {
  function currentPath(): string {
    return resolve(dataDir(), fileName)
  }

  async function read(): Promise<T[]> {
    const path = currentPath()
    if (!existsSync(path)) return []
    const raw = await readFile(path, 'utf8')
    if (!raw.trim()) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error(`Corrupt store: ${path} is not a JSON array`)
    }
    return parsed as T[]
  }

  async function writeAll(rows: T[]): Promise<void> {
    const path = currentPath()
    await mkdir(dirname(path), { recursive: true })
    const tmp = `${path}.tmp`
    await writeFile(tmp, JSON.stringify(rows, null, 2), 'utf8')
    await rename(tmp, path)
  }

  async function append(row: T): Promise<void> {
    const rows = await read()
    rows.push(row)
    await writeAll(rows)
  }

  async function upsert(row: T, keyOf: (r: T) => string): Promise<void> {
    const rows = await read()
    const k = keyOf(row)
    const idx = rows.findIndex((r) => keyOf(r) === k)
    if (idx >= 0) rows[idx] = row
    else rows.push(row)
    await writeAll(rows)
  }

  return {
    get path(): string {
      return currentPath()
    },
    read,
    writeAll,
    append,
    upsert,
  }
}

export const stores = {
  candidates:
    jsonStore<import('../types.js').ProductCandidate>('candidates.json'),
  drafts: jsonStore<import('../types.js').PinDraft>('drafts.json'),
  approved: jsonStore<import('../types.js').PinDraft>('approved.json'),
  published: jsonStore<import('../types.js').PinDraft>('published.json'),
}
