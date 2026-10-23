import { describe, expect, it } from 'vitest'
import {
  emptyStats,
  focusMinutesOf,
  localDateKey,
  recordFocus,
  restoreStats,
  statsForToday,
} from './stats'

describe('今日統計', () => {
  it('完成一個 25 分鐘專注：蕃茄 +1、專注 25 分', () => {
    const stats = recordFocus(emptyStats('2026-10-23'), '2026-10-23', 1500)
    expect(stats).toEqual({ date: '2026-10-23', completedPomodoros: 1, focusSeconds: 1500 })
    expect(focusMinutesOf(stats)).toBe(25)
    expect(focusMinutesOf(recordFocus(stats, '2026-10-23', 1500))).toBe(50)
  })

  it('有秒數的專注照實累計：50:30 加 50:30 = 101 分', () => {
    const once = recordFocus(emptyStats('2026-10-23'), '2026-10-23', 3030)
    expect(focusMinutesOf(once)).toBe(50)
    expect(focusMinutesOf(recordFocus(once, '2026-10-23', 3030))).toBe(101)
  })

  it('跨日：昨天的 3 顆蕃茄不算到今天', () => {
    const yesterday = { date: '2026-10-22', completedPomodoros: 3, focusSeconds: 4500 }
    expect(statsForToday(yesterday, '2026-10-23')).toEqual(emptyStats('2026-10-23'))
    expect(recordFocus(yesterday, '2026-10-23', 1500).completedPomodoros).toBe(1)
  })

  it('日期用當地時間，午夜前後分屬兩天', () => {
    expect(localDateKey(new Date(2026, 9, 23, 23, 59).getTime())).toBe('2026-10-23')
    expect(localDateKey(new Date(2026, 9, 24, 0, 1).getTime())).toBe('2026-10-24')
  })

  it('第一版存的分鐘統計自動換算：今天 3 顆 75 分 → 4500 秒', () => {
    const restored = restoreStats(
      { date: '2026-10-23', completedPomodoros: 3, focusMinutes: 75 },
      '2026-10-23',
    )
    expect(restored).toEqual({ date: '2026-10-23', completedPomodoros: 3, focusSeconds: 4500 })
  })

  it('壞資料從 0 開始', () => {
    expect(restoreStats({ date: '2026-10-23', completedPomodoros: -1 }, '2026-10-23')).toEqual(
      emptyStats('2026-10-23'),
    )
    expect(restoreStats(null, '2026-10-23')).toEqual(emptyStats('2026-10-23'))
  })
})
