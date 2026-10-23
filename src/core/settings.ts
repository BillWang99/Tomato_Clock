// 使用者設定：預設值與檢查。存在 localStorage，讀回來時一律經過 normalizeSettings，壞資料不會讓畫面壞掉。

export interface Settings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakInterval: number
  autoStartNext: boolean
  soundOn: boolean
  volume: number
  keepAwake: boolean
  scanlines: boolean
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartNext: false,
  soundOn: true,
  volume: 0.6,
  keepAwake: false,
  scanlines: true,
})

type NumberKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never
}[keyof Settings]

export interface NumberRange {
  min: number
  max: number
  step: number
}

// 畫面上步進器的範圍也從這裡拿，確保「能設定的值」與「存得進去的值」一致
export const SETTING_RANGES: Readonly<Record<NumberKey, NumberRange>> = Object.freeze({
  focusMinutes: { min: 1, max: 90, step: 1 },
  shortBreakMinutes: { min: 1, max: 30, step: 1 },
  longBreakMinutes: { min: 1, max: 60, step: 1 },
  longBreakInterval: { min: 2, max: 8, step: 1 },
  volume: { min: 0, max: 1, step: 0.1 },
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

  for (const key of Object.keys(SETTING_RANGES) as NumberKey[]) {
    const value = source[key]
    if (typeof value === 'number') result[key] = clampToRange(value, SETTING_RANGES[key])
  }
  for (const key of ['autoStartNext', 'soundOn', 'keepAwake', 'scanlines'] as const) {
    const value = source[key]
    if (typeof value === 'boolean') result[key] = value
  }
  return result
}
