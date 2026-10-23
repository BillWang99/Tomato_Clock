import { describe, expect, it } from 'vitest'
import {
  clearEntry,
  entryFromSeconds,
  entryToSeconds,
  isValidEntry,
  pressBackspace,
  pressDigit,
  selectSegment,
  stepSegment,
  type DurationEntry,
} from './durationInput'

function type(entry: DurationEntry, keys: string): DurationEntry {
  return [...keys].reduce((e, key) => pressDigit(e, Number(key)), entry)
}

const show = (e: DurationEntry) =>
  `${String(e.minutes).padStart(2, '0')}:${String(e.seconds).padStart(2, '0')}`

describe('時間鍵盤（分、秒兩格）', () => {
  it('打開時顯示目前時長 25:00，先輸入分鐘', () => {
    const entry = entryFromSeconds(1500)
    expect(show(entry)).toBe('25:00')
    expect(entry.segment).toBe('minutes')
  })

  it('從 25:00 只按 5 → 05:00（5 分鐘，不是 5 秒）', () => {
    const entry = type(entryFromSeconds(1500), '5')
    expect(show(entry)).toBe('05:00')
    expect(entryToSeconds(entry)).toBe(300)
  })

  it('依序按 5、0、3、0 → 分鐘打滿兩位自動跳到秒 → 50:30 = 3030 秒', () => {
    const afterMinutes = type(entryFromSeconds(1500), '50')
    expect(afterMinutes.segment).toBe('seconds')
    const entry = type(afterMinutes, '30')
    expect(show(entry)).toBe('50:30')
    expect(entryToSeconds(entry)).toBe(3030)
  })

  it('點「秒」那格再按 4、5 → 25:45；第一個數字取代原本的秒數', () => {
    const entry = type(selectSegment(entryFromSeconds(1510), 'seconds'), '45')
    expect(show(entry)).toBe('25:45')
  })

  it('秒數不能超過 59：先 7 再 5 → 從 5 重來 = 05 秒', () => {
    const entry = type(selectSegment(clearEntry(), 'seconds'), '75')
    expect(entry.seconds).toBe(5)
  })

  it('▲▼ 一次加減 1，分鐘 0～99、秒 0～59 循環', () => {
    const start = entryFromSeconds(1500)
    expect(show(stepSegment(start, 'minutes', 1))).toBe('26:00')
    expect(show(stepSegment(start, 'seconds', -1))).toBe('25:59')
    expect(show(stepSegment(entryFromSeconds(99 * 60), 'minutes', 1))).toBe('00:00')
  })

  it('刪除一位：分鐘 25 → 2', () => {
    const entry = pressBackspace(type(entryFromSeconds(0), '2'))
    expect(entry.minutes).toBe(0)
    expect(pressBackspace({ ...entryFromSeconds(1500), typed: 2 }).minutes).toBe(2)
  })

  it('00:00 不能確定，00:01～99:59 可以', () => {
    expect(isValidEntry(clearEntry())).toBe(false)
    expect(isValidEntry(type(selectSegment(clearEntry(), 'seconds'), '1'))).toBe(true)
    expect(isValidEntry(entryFromSeconds(5999))).toBe(true)
  })
})
