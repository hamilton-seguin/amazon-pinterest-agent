import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function dataDir(): string {
  const override = process.env.APP_DATA_DIR
  if (override && override.trim()) return resolve(override)
  return resolve(process.cwd(), 'data')
}

/**
 * Serializes async work so concurrent callers (UI bridge + CLI + StrictMode
 * double-invocations) don't interleave read-modify-write on the same file.
 */
function createMutex() {
  let tail: Promise<unknown> = Promise.resolve()
  return function lock<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn, fn)
    tail = run.catch(() => undefined)
    return run
  }
}

export interface JsonStore<T> {
  readonly path: string
  read(): Promise<T[]>
  writeAll(rows: T[]): Promise<void>
  append(row: T): Promise<void>
  upsert(row: T, keyOf: (r: T) => string): Promise<void>
  /** Atomic read-modify-write under the store's mutex. */
  update(mutate: (rows: T[]) => T[] | Promise<T[]>): Promise<T[]>
}

export function jsonStore<T>(fileName: string): JsonStore<T> {
  const lock = createMutex()

  function currentPath(): string {
    return resolve(dataDir(), fileName)
  }

  async function readUnlocked(): Promise<T[]> {
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

  async function writeAllUnlocked(rows: T[]): Promise<void> {
    const path = currentPath()
    await mkdir(dirname(path), { recursive: true })
    const tmp = `${path}.tmp`
    await writeFile(tmp, JSON.stringify(rows, null, 2), 'utf8')
    await rename(tmp, path)
  }

  function read(): Promise<T[]> {
    return lock(readUnlocked)
  }

  function writeAll(rows: T[]): Promise<void> {
    return lock(() => writeAllUnlocked(rows))
  }

  function append(row: T): Promise<void> {
    return lock(async () => {
      const rows = await readUnlocked()
      rows.push(row)
      await writeAllUnlocked(rows)
    })
  }

  function upsert(row: T, keyOf: (r: T) => string): Promise<void> {
    return lock(async () => {
      const rows = await readUnlocked()
      const k = keyOf(row)
      const idx = rows.findIndex((r) => keyOf(r) === k)
      if (idx >= 0) rows[idx] = row
      else rows.push(row)
      await writeAllUnlocked(rows)
    })
  }

  function update(mutate: (rows: T[]) => T[] | Promise<T[]>): Promise<T[]> {
    return lock(async () => {
      const rows = await readUnlocked()
      const next = await mutate(rows)
      await writeAllUnlocked(next)
      return next
    })
  }

  return {
    get path(): string {
      return currentPath()
    },
    read,
    writeAll,
    append,
    upsert,
    update,
  }
}

export const stores = {
  candidates:
    jsonStore<import('../types.js').ProductCandidate>('candidates.json'),
  drafts: jsonStore<import('../types.js').PinDraft>('drafts.json'),
  approved: jsonStore<import('../types.js').PinDraft>('approved.json'),
  published: jsonStore<import('../types.js').PinDraft>('published.json'),
}
