// 使用者設定：預設值與檢查。存在 localStorage，讀回來時一律經過 normalizeSettings，壞資料不會讓畫面壞掉。

export interface Settings {
  focusSeconds: number
  shortBreakSeconds: number
  longBreakSeconds: number
  longBreakInterval: number
  autoStartNext: boolean
  soundOn: boolean
  volume: number
  keepAwake: boolean
  scanlines: boolean
  /** 鎖螢幕也提醒（推播），要使用者自己打開 */
  pushAlerts: boolean
}

export type DurationKey = 'focusSeconds' | 'shortBreakSeconds' | 'longBreakSeconds'

export const DURATION_KEYS: readonly DurationKey[] = [
  'focusSeconds',
  'shortBreakSeconds',
  'longBreakSeconds',
]

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  focusSeconds: 25 * 60,
  shortBreakSeconds: 5 * 60,
  longBreakSeconds: 15 * 60,
  longBreakInterval: 4,
  autoStartNext: false,
  soundOn: true,
  volume: 0.6,
  keepAwake: false,
  scanlines: true,
  pushAlerts: false,
})

type NumberKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never
}[keyof Settings]

export interface NumberRange {
  min: number
  max: number
  step: number
}

/** 時長一律 00:01～99:59，也就是時間鍵盤四位數能輸入的最大值 */
export const DURATION_RANGE: Readonly<NumberRange> = Object.freeze({ min: 1, max: 5999, step: 1 })

/** 時長旁邊的 −／+ 一次加減 1 分鐘 */
export const DURATION_BUTTON_STEP = 60

// 畫面上步進器的範圍也從這裡拿，確保「能設定的值」與「存得進去的值」一致
export const SETTING_RANGES: Readonly<Record<NumberKey, NumberRange>> = Object.freeze({
  focusSeconds: DURATION_RANGE,
  shortBreakSeconds: DURATION_RANGE,
  longBreakSeconds: DURATION_RANGE,
  longBreakInterval: { min: 2, max: 8, step: 1 },
  volume: { min: 0, max: 1, step: 0.1 },
})

// 第一版（v0.1.0）存的是分鐘，讀到舊欄位就換算成秒，使用者原本的設定不會不見
const LEGACY_MINUTE_KEYS: Readonly<Record<DurationKey, string>> = Object.freeze({
  focusSeconds: 'focusMinutes',
  shortBreakSeconds: 'shortBreakMinutes',
  longBreakSeconds: 'longBreakMinutes',
})

export function clampToRange(value: number, range: NumberRange): number {
  if (!Number.isFinite(value)) return range.min
  const stepped = Math.round(value / range.step) * range.step
  // 0.1 的倍數會有浮點誤差（0.30000000000000004），四捨五入到小數兩位
  const rounded = Math.round(stepped * 100) / 100
  return Math.min(range.max, Math.max(range.min, rounded))
}

// 把任何來源（舊版資料、手動改壞的 localStorage）整理成合法設定
export function normalizeSettings(raw: unknown): Settings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const result: Settings = { ...DEFAULT_SETTINGS }

  for (const key of DURATION_KEYS) {
    const legacy = source[LEGACY_MINUTE_KEYS[key]]
    if (typeof source[key] !== 'number' && typeof legacy === 'number') {
      result[key] = clampToRange(legacy * 60, DURATION_RANGE)
    }
  }
  for (const key of Object.keys(SETTING_RANGES) as NumberKey[]) {
    const value = source[key]
    if (typeof value === 'number') result[key] = clampToRange(value, SETTING_RANGES[key])
  }
  for (const key of ['autoStartNext', 'soundOn', 'keepAwake', 'scanlines', 'pushAlerts'] as const) {
    const value = source[key]
    if (typeof value === 'boolean') result[key] = value
  }
  return result
}
