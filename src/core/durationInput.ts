// 時間鍵盤的輸入規則：分、秒分開兩格，一次只輸入其中一格。
// 打開時先輸入「分」：按 5 就是 05:00；分鐘打滿兩位自動跳到「秒」，所以 5、0、3、0 → 50:30。
// 也可以直接點「分」或「秒」那一格切換，或用 ▲▼ 一次加減 1。

import { DURATION_RANGE } from './settings'

export type Segment = 'minutes' | 'seconds'

export interface DurationEntry {
  minutes: number
  seconds: number
  /** 現在數字鍵會打進哪一格 */
  segment: Segment
  /** 這一格已經打了幾位數：0 表示下一個數字會取代原本的值 */
  typed: number
}

export const MAX_MINUTES = 99
export const MAX_SECONDS = 59

export function entryFromSeconds(total: number): DurationEntry {
  return { minutes: Math.floor(total / 60), seconds: total % 60, segment: 'minutes', typed: 0 }
}

export function selectSegment(entry: DurationEntry, segment: Segment): DurationEntry {
  return { ...entry, segment, typed: 0 }
}

export function pressDigit(entry: DurationEntry, digit: number): DurationEntry {
  const { segment } = entry
  const max = segment === 'minutes' ? MAX_MINUTES : MAX_SECONDS
  const current = entry[segment]
  // 第一位數取代原本的值；第二位接在後面。秒數超過 59（例如先 7 再 5）就從這個數字重來
  let value = entry.typed === 0 ? digit : current * 10 + digit
  if (value > max) value = digit
  const typed = entry.typed === 0 || value === digit ? 1 : 2
  const next = { ...entry, [segment]: value, typed }
  // 分鐘打滿兩位，自動換到秒
  if (segment === 'minutes' && typed === 2) return selectSegment(next, 'seconds')
  return next
}

export function pressBackspace(entry: DurationEntry): DurationEntry {
  const { segment } = entry
  const value = Math.floor(entry[segment] / 10)
  return { ...entry, [segment]: value, typed: value === 0 ? 0 : 1 }
}

/** ▲▼：分鐘 0～99、秒 0～59 循環 */
export function stepSegment(entry: DurationEntry, segment: Segment, delta: 1 | -1): DurationEntry {
  const size = (segment === 'minutes' ? MAX_MINUTES : MAX_SECONDS) + 1
  const value = (entry[segment] + delta + size) % size
  return { ...entry, [segment]: value, segment, typed: 0 }
}

export function clearEntry(): DurationEntry {
  return { minutes: 0, seconds: 0, segment: 'minutes', typed: 0 }
}

export function entryToSeconds(entry: DurationEntry): number {
  return entry.minutes * 60 + entry.seconds
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function isValidEntry(entry: DurationEntry): boolean {
  const seconds = entryToSeconds(entry)
  return seconds >= DURATION_RANGE.min && seconds <= DURATION_RANGE.max
}
