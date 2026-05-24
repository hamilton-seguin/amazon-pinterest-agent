import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface TmpDataDir {
  path: string
  cleanup(): Promise<void>
  seed(file: string, rows: unknown[]): Promise<void>
}

export async function createTmpDataDir(): Promise<TmpDataDir> {
  const dir = await mkdtemp(join(tmpdir(), 'affiliate-script-test-'))
  process.env.APP_DATA_DIR = dir
  await mkdir(dir, { recursive: true })

  async function seed(file: string, rows: unknown[]): Promise<void> {
    await writeFile(join(dir, file), JSON.stringify(rows, null, 2), 'utf8')
  }

  async function cleanup(): Promise<void> {
    delete process.env.APP_DATA_DIR
    await rm(dir, { recursive: true, force: true })
  }

  return { path: dir, cleanup, seed }
}
