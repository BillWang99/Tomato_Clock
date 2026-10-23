import { describe, expect, it } from 'vitest'
import {
  clearEntry,
  entryDisplay,
  entryFromSeconds,
  entryToSeconds,
  isValidEntry,
  pressBackspace,
  pressDigit,
  type KeypadEntry,
} from './durationInput'

function type(entry: KeypadEntry, keys: string): KeypadEntry {
  return [...keys].reduce(pressDigit, entry)
}

describe('時間鍵盤輸入', () => {
  it('打開時顯示目前時長 25:00', () => {
    expect(entryDisplay(entryFromSeconds(1500))).toBe('25:00')
  })

  it('從 25:00 依序按 5、0、3、0 → 50:30 = 3030 秒（第一個數字取代原本的時間）', () => {
    const entry = type(entryFromSeconds(1500), '5030')
    expect(entryDisplay(entry)).toBe('50:30')
    expect(entryToSeconds(entry)).toBe(3030)
  })

  it('只按 9、0 → 00:90，確定時算成 90 秒（1 分 30 秒）', () => {
    const entry = type(entryFromSeconds(1500), '90')
    expect(entryDisplay(entry)).toBe('00:90')
    expect(entryToSeconds(entry)).toBe(90)
  })

  it('最多四位數，第五個數字不接受', () => {
    expect(entryDisplay(type(clearEntry(), '12345'))).toBe('12:34')
  })

  it('刪除一位：50:30 → 05:03', () => {
    expect(entryDisplay(pressBackspace(type(clearEntry(), '5030')))).toBe('05:03')
  })

  it('開頭的 0 不算：按 0、0、5 → 00:05', () => {
    expect(entryDisplay(type(clearEntry(), '005'))).toBe('00:05')
  })

  it('00:00 與超過 99:59 的不能確定', () => {
    expect(isValidEntry(clearEntry())).toBe(false)
    expect(isValidEntry(type(clearEntry(), '9999'))).toBe(false)
    expect(isValidEntry(type(clearEntry(), '9959'))).toBe(true)
    expect(isValidEntry(type(clearEntry(), '1'))).toBe(true)
  })
})
