import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { jsonStore } from '../../src/storage/jsonStore.js'
import { createTmpDataDir, type TmpDataDir } from '../fixtures/tmpDataDir.js'

interface Row {
  id: string
  value: number
}

describe('jsonStore', () => {
  let tmp: TmpDataDir

  beforeEach(async () => {
    tmp = await createTmpDataDir()
  })

  afterEach(async () => {
    await tmp.cleanup()
  })

  it('returns [] when file does not exist', async () => {
    const store = jsonStore<Row>('rows.json')
    expect(await store.read()).toEqual([])
  })

  it('writes and reads rows', async () => {
    const store = jsonStore<Row>('rows.json')
    await store.writeAll([{ id: 'a', value: 1 }])
    expect(await store.read()).toEqual([{ id: 'a', value: 1 }])
  })

  it('upsert updates an existing row without losing others', async () => {
    const store = jsonStore<Row>('rows.json')
    await store.writeAll([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ])
    await store.upsert({ id: 'a', value: 99 }, (r) => r.id)
    expect(await store.read()).toEqual([
      { id: 'a', value: 99 },
      { id: 'b', value: 2 },
    ])
  })

  it('upsert appends when key is new', async () => {
    const store = jsonStore<Row>('rows.json')
    await store.writeAll([{ id: 'a', value: 1 }])
    await store.upsert({ id: 'c', value: 3 }, (r) => r.id)
    const rows = await store.read()
    expect(rows.map((r) => r.id).sort()).toEqual(['a', 'c'])
  })

  it('append adds to existing rows', async () => {
    const store = jsonStore<Row>('rows.json')
    await store.writeAll([{ id: 'a', value: 1 }])
    await store.append({ id: 'b', value: 2 })
    expect(await store.read()).toHaveLength(2)
  })

  it('treats empty file as empty array', async () => {
    const path = join(tmp.path, 'rows.json')
    await writeFile(path, '   ', 'utf8')
    const store = jsonStore<Row>('rows.json')
    expect(await store.read()).toEqual([])
  })

  it('throws clear error when file is non-array JSON', async () => {
    await tmp.seed('rows.json', {} as never)
    const store = jsonStore<Row>('rows.json')
    await expect(store.read()).rejects.toThrow(/not a JSON array/)
  })

  it('throws clear error when JSON is malformed', async () => {
    await writeFile(join(tmp.path, 'rows.json'), '{bad json', 'utf8')
    const store = jsonStore<Row>('rows.json')
    await expect(store.read()).rejects.toThrow()
  })

  it('writes atomically (no .tmp left behind)', async () => {
    const store = jsonStore<Row>('rows.json')
    await store.writeAll([{ id: 'a', value: 1 }])
    const fs = await import('node:fs/promises')
    const files = await fs.readdir(tmp.path)
    expect(files).toContain('rows.json')
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('writes pretty JSON to the correct file in APP_DATA_DIR', async () => {
    const store = jsonStore<Row>('rows.json')
    await store.writeAll([{ id: 'a', value: 1 }])
    const raw = await readFile(join(tmp.path, 'rows.json'), 'utf8')
    expect(raw).toContain('"id"')
    expect(JSON.parse(raw)).toEqual([{ id: 'a', value: 1 }])
  })
})
