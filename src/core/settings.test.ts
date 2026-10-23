import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings } from './settings'

describe('設定檢查', () => {
  it('沒有資料時用預設值 25／5／15、每 4 個接長休息', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('超出範圍的值夾回範圍內：專注 0 → 1、120 → 90', () => {
    expect(normalizeSettings({ focusMinutes: 0 }).focusMinutes).toBe(1)
    expect(normalizeSettings({ focusMinutes: 120 }).focusMinutes).toBe(90)
  })

  it('型別不對的欄位用預設值，其他欄位照常讀', () => {
    const s = normalizeSettings({ focusMinutes: '50', soundOn: false, volume: 0.30000000000000004 })
    expect(s.focusMinutes).toBe(25)
    expect(s.soundOn).toBe(false)
    expect(s.volume).toBe(0.3)
  })
})
