import { maskRecord } from './maskSecret.js'

type Level = 'debug' | 'info' | 'warn' | 'error'
const ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

let currentLevel: Level = 'info'

export function setLogLevel(level: Level): void {
  currentLevel = level
}

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[currentLevel]) return
  const ts = new Date().toISOString()
  const tag = level.toUpperCase().padEnd(5)
  if (meta && Object.keys(meta).length > 0) {
    const safe = maskRecord(meta)
    console.log(`${ts} ${tag} ${msg} ${JSON.stringify(safe)}`)
  } else {
    console.log(`${ts} ${tag} ${msg}`)
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) =>
    emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) =>
    emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) =>
    emit('error', msg, meta),
}
