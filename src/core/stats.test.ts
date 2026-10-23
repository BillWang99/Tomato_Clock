import { describe, expect, it } from 'vitest'
import { emptyStats, localDateKey, recordFocus, restoreStats, statsForToday } from './stats'

describe('今日統計', () => {
  it('完成一個 25 分鐘專注：蕃茄 +1、專注分鐘 +25', () => {
    const stats = recordFocus(emptyStats('2026-10-23'), '2026-10-23', 25)
    expect(stats).toEqual({ date: '2026-10-23', completedPomodoros: 1, focusMinutes: 25 })
    expect(recordFocus(stats, '2026-10-23', 25)).toEqual({
      date: '2026-10-23',
      completedPomodoros: 2,
      focusMinutes: 50,
    })
  })

  it('跨日：昨天的 3 顆蕃茄不算到今天', () => {
    const yesterday = { date: '2026-10-22', completedPomodoros: 3, focusMinutes: 75 }
    expect(statsForToday(yesterday, '2026-10-23')).toEqual(emptyStats('2026-10-23'))
    expect(recordFocus(yesterday, '2026-10-23', 25).completedPomodoros).toBe(1)
  })

  it('日期用當地時間，午夜前後分屬兩天', () => {
    expect(localDateKey(new Date(2026, 9, 23, 23, 59).getTime())).toBe('2026-10-23')
    expect(localDateKey(new Date(2026, 9, 24, 0, 1).getTime())).toBe('2026-10-24')
  })

  it('壞資料從 0 開始', () => {
    expect(restoreStats({ date: '2026-10-23', completedPomodoros: -1 }, '2026-10-23')).toEqual(
      emptyStats('2026-10-23'),
    )
    expect(restoreStats(null, '2026-10-23')).toEqual(emptyStats('2026-10-23'))
  })
})
