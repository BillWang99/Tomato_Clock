import { describe, expect, it } from 'vitest'
import { isPushEndpoint, MAX_DELAY_MS, parseCancel, parseSchedule } from '../src/validate'

function base64url(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

// 形狀正確的金鑰：65 bytes 且開頭是 0x04 的公鑰、16 bytes 的驗證密鑰
const P256DH = base64url([4, ...Array(64).fill(7)])
const AUTH = base64url(Array(16).fill(9))
const subscription = {
  endpoint: 'https://web.push.apple.com/QGJ6abc',
  keys: { p256dh: P256DH, auth: AUTH },
}

function schedule(overrides: Record<string, unknown> = {}) {
  return parseSchedule({
    subscription,
    delayMs: 25 * 60_000,
    phase: 'focus',
    token: 't1',
    ...overrides,
  })
}

describe('推播網址白名單', () => {
  it('接受 Apple、Google、Mozilla、微軟的推播服務', () => {
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true)
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true)
    expect(isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=abc')).toBe(true)
  })

  it('拒絕其他網址：避免伺服器被拿來打任意網站', () => {
    expect(isPushEndpoint('https://evil.example.com/abc')).toBe(false)
    expect(isPushEndpoint('https://web.push.apple.com.evil.com/abc')).toBe(false)
    expect(isPushEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false)
    expect(isPushEndpoint('不是網址')).toBe(false)
  })
})

describe('排程請求', () => {
  it('合法的 25 分鐘專注提醒通過', () => {
    expect(schedule()).toEqual({
      ok: true,
      value: { subscription, delayMs: 1_500_000, phase: 'focus', token: 't1' },
    })
  })

  it('提醒時間限 1 秒～100 分鐘', () => {
    expect(schedule({ delayMs: 999 }).ok).toBe(false)
    expect(schedule({ delayMs: 1000 }).ok).toBe(true)
    expect(schedule({ delayMs: MAX_DELAY_MS }).ok).toBe(true)
    expect(schedule({ delayMs: MAX_DELAY_MS + 1 }).ok).toBe(false)
    expect(schedule({ delayMs: 1500.5 }).ok).toBe(false)
  })

  it('金鑰看起來是 base64 但長度或內容不對：拒絕（不然到時間加密才出錯）', () => {
    const withKeys = (p256dh: string, auth: string) =>
      schedule({ subscription: { ...subscription, keys: { p256dh, auth } } }).ok
    expect(withKeys('AAAA', AUTH)).toBe(false)
    expect(withKeys(base64url([5, ...Array(64).fill(7)]), AUTH)).toBe(false)
    expect(withKeys(P256DH, base64url(Array(15).fill(9)))).toBe(false)
    expect(withKeys(P256DH, AUTH)).toBe(true)
  })

  it('階段、編號、金鑰格式不對都拒絕', () => {
    expect(schedule({ phase: 'lunch' }).ok).toBe(false)
    expect(schedule({ token: '有空白 的編號' }).ok).toBe(false)
    expect(
      schedule({ subscription: { ...subscription, keys: { p256dh: '<script>', auth: 'a' } } }).ok,
    ).toBe(false)
    expect(parseSchedule(null).ok).toBe(false)
  })
})

describe('取消請求', () => {
  it('需要推播網址與編號', () => {
    expect(parseCancel({ endpoint: subscription.endpoint, token: 't1' }).ok).toBe(true)
    expect(parseCancel({ endpoint: 'https://evil.example.com', token: 't1' }).ok).toBe(false)
    expect(parseCancel({ endpoint: subscription.endpoint }).ok).toBe(false)
  })
})

describe('頻率限制的對象', () => {
  it('IPv4 用完整位址；IPv6 用前 64 位元的網段（換同網段的位址也算同一人）', async () => {
    const { rateLimitKey } = await import('../src/index')
    expect(rateLimitKey('203.0.113.7')).toBe('203.0.113.7')
    expect(rateLimitKey('2001:db8:abcd:12:1::5')).toBe('2001:db8:abcd:12::/64')
    expect(rateLimitKey('2001:0db8:abcd:0012:ffff:ffff:ffff:ffff')).toBe('2001:db8:abcd:12::/64')
    expect(rateLimitKey('2001:db8::1')).toBe('2001:db8:0:0::/64')
  })
})
