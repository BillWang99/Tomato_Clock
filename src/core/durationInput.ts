// 時間鍵盤的輸入規則，像微波爐：數字從右邊推進來，最後兩位是秒。
// 輸入 5、0、3、0 → 50:30；輸入 9、0 → 00:90，確定時算成 1 分 30 秒。

import { DURATION_RANGE } from './settings'

const MAX_DIGITS = 4

export interface KeypadEntry {
  /** 已輸入的數字，不含前導 0，最多 4 位 */
  digits: string
  /** true 表示還沒開始輸入：第一個按下的數字會取代原本的時間，而不是接在後面 */
  fresh: boolean
}

export function entryFromSeconds(seconds: number): KeypadEntry {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  const value = minutes * 100 + rest
  return { digits: value > 0 ? String(value) : '', fresh: true }
}

export function pressDigit(entry: KeypadEntry, digit: string): KeypadEntry {
  const base = entry.fresh ? '' : entry.digits
  if (base.length >= MAX_DIGITS) return { ...entry, fresh: false }
  const digits = `${base}${digit}`.replace(/^0+/, '')
  return { digits, fresh: false }
}

export function pressBackspace(entry: KeypadEntry): KeypadEntry {
  return { digits: entry.fresh ? '' : entry.digits.slice(0, -1), fresh: false }
}

export function clearEntry(): KeypadEntry {
  return { digits: '', fresh: false }
}

export function entryToSeconds(entry: KeypadEntry): number {
  const value = Number(entry.digits || 0)
  return Math.floor(value / 100) * 60 + (value % 100)
}

/** 輸入中的樣子，固定四位數，例如 "00:90"、"50:30" */
export function entryDisplay(entry: KeypadEntry): string {
  const padded = entry.digits.padStart(MAX_DIGITS, '0')
  return `${padded.slice(0, 2)}:${padded.slice(2)}`
}

export function isValidEntry(entry: KeypadEntry): boolean {
  const seconds = entryToSeconds(entry)
  return seconds >= DURATION_RANGE.min && seconds <= DURATION_RANGE.max
}
