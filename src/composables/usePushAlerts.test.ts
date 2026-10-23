import { describe, expect, it, vi } from 'vitest'
import { pause, start } from '@/core/timer'
import {
  calls,
  fetchMock,
  installPushBrowser,
  settle,
  setup,
  subscribe,
  SUBSCRIPTION,
  T0,
  usePushTestHooks,
} from './pushAlertsTestkit'

vi.mock('@/core/pushConfig', () => ({
  PUSH_API_URL: 'https://tomato-push.test',
  VAPID_PUBLIC_KEY: 'BPublicKeyForTest',
  isPushConfigured: () => true,
}))

describe('鎖螢幕也提醒', () => {
  usePushTestHooks()

  it('預設關閉；打開時才問通知權限並訂閱推播', async () => {
    const { push, settings, scope } = setup()
    expect(push.status.value).toBe('off')
    expect(Notification.requestPermission).not.toHaveBeenCalled()

    await push.toggle(true)
    expect(Notification.requestPermission).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: 'BPublicKeyForTest',
    })
    expect(settings.value.pushAlerts).toBe(true)
    expect(push.status.value).toBe('on')
    scope.stop()
  })

  it('推播開著、開始 25 分鐘專注 → 請伺服器 25 分鐘後提醒；暫停 → 取消', async () => {
    const { push, timer, scope } = setup()
    await push.toggle(true)

    timer.value = start(timer.value, T0)
    await settle()
    expect(calls('/api/schedule')).toEqual([
      {
        subscription: SUBSCRIPTION,
        delayMs: 25 * 60_000,
        phase: 'focus',
        token: String(T0 + 25 * 60_000),
      },
    ])

    timer.value = pause(timer.value, T0 + 60_000)
    await settle()
    expect(calls('/api/cancel')).toEqual([
      { endpoint: SUBSCRIPTION.endpoint, token: String(T0 + 25 * 60_000) },
    ])
    scope.stop()
  })

  it('推播關著時開始計時：完全不呼叫伺服器', async () => {
    const { timer, scope } = setup()
    timer.value = start(timer.value, T0)
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    scope.stop()
  })

  it('取消時斷網：顯示說明、記住編號，下次狀態改變時再取消一次', async () => {
    const { push, timer, scope } = setup()
    await push.toggle(true)
    timer.value = start(timer.value, T0)
    await settle()

    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    timer.value = pause(timer.value, T0 + 60_000)
    await settle()
    expect(push.errorMessage.value).toContain('連不上推播伺服器')

    timer.value = { ...timer.value, remainingMs: timer.value.remainingMs - 1 }
    await settle()
    expect(calls('/api/cancel')).toHaveLength(2)
    expect(push.errorMessage.value).toBe('')
    scope.stop()
  })

  it('使用者拒絕通知：開關不會打開，顯示要到系統設定開啟', async () => {
    installPushBrowser('denied')
    const { push, settings, scope } = setup()
    await push.toggle(true)
    expect(settings.value.pushAlerts).toBe(false)
    expect(push.status.value).toBe('denied')
    scope.stop()
  })

  it('iPhone 在 Safari 分頁裡打開：提示要先加到主畫面', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15',
    )
    const { push, scope } = setup()
    expect(push.status.value).toBe('needsInstall')
    scope.stop()
  })

  it('排程請求送到了但回應遺失（逾時）：之後按暫停仍會送取消，不會照原時間跳通知', async () => {
    const { push, timer, scope } = setup()
    await push.toggle(true)
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
    timer.value = start(timer.value, T0)
    await settle()
    expect(push.errorMessage.value).toContain('連不上推播伺服器')

    timer.value = pause(timer.value, T0 + 60_000)
    await settle()
    expect(calls('/api/cancel')).toEqual([
      { endpoint: SUBSCRIPTION.endpoint, token: String(T0 + 25 * 60_000) },
    ])
    scope.stop()
  })

  it('打開開關時訂閱失敗：開關維持關閉，而且看得到失敗原因', async () => {
    subscribe.mockRejectedValueOnce(new Error('推播服務拒絕訂閱'))
    const { push, scope } = setup()
    await push.toggle(true)
    expect(push.status.value).toBe('off')
    expect(push.errorMessage.value).toBe('推播服務拒絕訂閱')
    scope.stop()
  })

  it('伺服器回 410（訂閱已失效）：自動退訂、重新訂閱，用新的推播位址再排一次', async () => {
    const { push, timer, scope } = setup()
    await push.toggle(true)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 410 }))
    timer.value = start(timer.value, T0)
    await settle()

    const scheduled = calls('/api/schedule')
    expect(scheduled).toHaveLength(2)
    expect(scheduled[0].subscription.endpoint).toBe('https://web.push.apple.com/device-1')
    expect(scheduled[1].subscription.endpoint).toBe('https://web.push.apple.com/device-2')
    expect(push.errorMessage.value).toBe('')
    scope.stop()
  })

  it('送給伺服器的是 text/plain（不用預檢請求）', async () => {
    const { push, timer, scope } = setup()
    await push.toggle(true)
    timer.value = start(timer.value, T0)
    await settle()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('Content-Type')).toContain('text/plain')
    scope.stop()
  })
})
