import { describe, expect, it } from 'vitest'
import { buildReport, levelOf, runMinutes } from './usageReport.mjs'

describe('用量報告', () => {
  it('提醒門檻：未滿 50% 正常、50% 起提醒、80% 起警告', () => {
    expect(levelOf(49_999, 100_000)).toBe('ok')
    expect(levelOf(50_000, 100_000)).toBe('notice')
    expect(levelOf(80_000, 100_000)).toBe('warning')
  })

  it('今天 14 次請求、public repo：一切在免費額度內', () => {
    const { lines, level } = buildReport({
      cloudflare: { workerRequests: 14, durableRequests: 11, errors: 0 },
      github: { runs: 12, minutes: 18, isPrivate: false },
    })
    expect(level).toBe('ok')
    expect(lines).toContain('  推播伺服器請求：14 / 100,000（0.0%）✔')
    expect(lines.join('\n')).toContain('public repo 不計費')
    expect(lines.at(-1)).toBe('結果：✔ 一切在免費額度內')
  })

  it('Durable Object 用到 85,000 次：警告並提示用總開關止血', () => {
    const { level, lines } = buildReport({
      cloudflare: { workerRequests: 20_000, durableRequests: 85_000, errors: 3 },
      github: { runs: 1, minutes: 1, isPrivate: false },
    })
    expect(level).toBe('warning')
    expect(lines.at(-1)).toContain('PUSH_ENABLED')
  })

  it('改成 private repo、本月用了 1,200 分鐘：超過 2,000 分鐘的一半，提醒', () => {
    const { level } = buildReport({
      cloudflare: { workerRequests: 0, durableRequests: 0, errors: 0 },
      github: { runs: 600, minutes: 1_200, isPrivate: true },
    })
    expect(level).toBe('notice')
  })

  it('讀不到 Cloudflare（沒登入）：說明怎麼處理，不算錯誤', () => {
    const { lines, level } = buildReport({ cloudflare: null, github: null })
    expect(lines.join('\n')).toContain('npx wrangler login')
    expect(level).toBe('ok')
  })

  it('部署分鐘數無條件進位：47 秒算 1 分鐘、1 分 10 秒算 2 分鐘', () => {
    expect(
      runMinutes({ run_started_at: '2026-10-24T00:00:00Z', updated_at: '2026-10-24T00:00:47Z' }),
    ).toBe(1)
    expect(
      runMinutes({ run_started_at: '2026-10-24T00:00:00Z', updated_at: '2026-10-24T00:01:10Z' }),
    ).toBe(2)
  })
})
