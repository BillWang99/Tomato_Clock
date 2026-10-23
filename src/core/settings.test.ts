import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings } from './settings'

describe('設定檢查', () => {
  it('沒有資料時用預設值 25:00／5:00／15:00、每 4 個接長休息', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.focusSeconds).toBe(1500)
  })

  it('時長可以設到秒：專注 50 分 30 秒 = 3030 秒原樣保存', () => {
    expect(normalizeSettings({ focusSeconds: 3030 }).focusSeconds).toBe(3030)
  })

  it('超出範圍的時長夾回 00:01～99:59：0 → 1 秒、6000 → 5999 秒', () => {
    expect(normalizeSettings({ focusSeconds: 0 }).focusSeconds).toBe(1)
    expect(normalizeSettings({ focusSeconds: 6000 }).focusSeconds).toBe(5999)
  })

  it('第一版存的分鐘設定自動換算：focusMinutes 50 → 3000 秒，其他設定照舊', () => {
    const s = normalizeSettings({
      focusMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 20,
      longBreakInterval: 3,
      soundOn: false,
    })
    expect(s.focusSeconds).toBe(3000)
    expect(s.shortBreakSeconds).toBe(600)
    expect(s.longBreakSeconds).toBe(1200)
    expect(s.longBreakInterval).toBe(3)
    expect(s.soundOn).toBe(false)
  })

  it('新舊欄位同時存在時以新的秒數為準', () => {
    expect(normalizeSettings({ focusMinutes: 50, focusSeconds: 90 }).focusSeconds).toBe(90)
  })

  it('型別不對的欄位用預設值，其他欄位照常讀', () => {
    const s = normalizeSettings({ focusSeconds: '50', soundOn: false, volume: 0.30000000000000004 })
    expect(s.focusSeconds).toBe(1500)
    expect(s.soundOn).toBe(false)
    expect(s.volume).toBe(0.3)
  })
})
