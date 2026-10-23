import { describe, expect, it } from 'vitest'
import { isRateLimited, resetTimeText, siteUpdatedSince } from './deployCheck.mjs'

describe('部署檢查', () => {
  it('GitHub 回 403 而且剩餘 0 次（或 429）：額度用完；一般的 403 不算', () => {
    expect(isRateLimited(403, new Headers({ 'x-ratelimit-remaining': '0' }))).toBe(true)
    expect(isRateLimited(429, new Headers())).toBe(true)
    expect(isRateLimited(403, new Headers({ 'x-ratelimit-remaining': '12' }))).toBe(false)
    expect(isRateLimited(200, new Headers({ 'x-ratelimit-remaining': '0' }))).toBe(false)
  })

  it('重置時間轉成 時:分；沒有標頭時說「約一小時內」', () => {
    const reset = Math.floor(new Date(2026, 9, 24, 7, 48, 39).getTime() / 1000)
    expect(resetTimeText(new Headers({ 'x-ratelimit-reset': String(reset) }))).toBe('07:48')
    expect(resetTimeText(new Headers())).toBe('約一小時內')
  })

  it('網站最後更新 07:22:25 晚於 commit 07:21:43：已部署；早於 commit：還沒', () => {
    const commit = Date.parse('2026-10-23T23:21:43Z') / 1000
    expect(siteUpdatedSince('Fri, 23 Oct 2026 23:22:25 GMT', commit)).toBe(true)
    expect(siteUpdatedSince('Fri, 23 Oct 2026 23:20:00 GMT', commit)).toBe(false)
    expect(siteUpdatedSince(null, commit)).toBe(false)
  })
})
