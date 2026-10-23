import { describe, expect, it, vi } from 'vitest'
import { pause, start } from '@/core/timer'
import {
  calls,
  fetchMock,
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

describe('鎖螢幕也提醒：中斷、金鑰換新與伺服器狀態', () => {
  usePushTestHooks()

  it('推播金鑰換新後：手機上舊金鑰的訂閱自動退訂、用新金鑰重新訂閱再排提醒', async () => {
    const unsubscribe = vi.fn(async () => true)
    const oldSubscription = {
      toJSON: () => ({ ...SUBSCRIPTION, endpoint: 'https://web.push.apple.com/old-device' }),
      options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
      unsubscribe,
    }
    const registration = await navigator.serviceWorker.ready
    vi.mocked(registration.pushManager.getSubscription).mockResolvedValueOnce(
      oldSubscription as unknown as PushSubscription,
    )
    // 之前就允許過通知、也打開過推播
    Object.assign(Notification, { permission: 'granted' })
    const { timer, scope } = setup({ pushAlerts: true })

    timer.value = start(timer.value, T0)
    await settle()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: 'BPublicKeyForTest',
    })
    const scheduled = calls('/api/schedule')
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].subscription.endpoint).toBe('https://web.push.apple.com/device-1')
    scope.stop()
  })

  it('只是取消提醒時遇到舊金鑰的訂閱：照樣送出取消，不把訂閱退掉', async () => {
    const unsubscribe = vi.fn(async () => true)
    const oldSubscription = {
      toJSON: () => ({ ...SUBSCRIPTION, endpoint: 'https://web.push.apple.com/old-device' }),
      options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
      unsubscribe,
    }
    const registration = await navigator.serviceWorker.ready
    vi.mocked(registration.pushManager.getSubscription).mockResolvedValue(
      oldSubscription as unknown as PushSubscription,
    )
    // 重新整理前排過一個提醒，現在要取消
    localStorage.setItem('tomato:push', JSON.stringify('old-token'))
    Object.assign(Notification, { permission: 'granted' })
    const { scope } = setup({ pushAlerts: true })
    await settle()

    expect(unsubscribe).not.toHaveBeenCalled()
    expect(calls('/api/cancel')).toEqual([
      { endpoint: 'https://web.push.apple.com/old-device', token: 'old-token' },
    ])
    scope.stop()
  })

  it('伺服器回 503：總開關關閉顯示「暫停服務中」，暫時出錯顯示「伺服器出錯」', async () => {
    const { push, timer, scope } = setup()
    await push.toggle(true)
    fetchMock.mockResolvedValueOnce(Response.json({ error: '推播暫停服務' }, { status: 503 }))
    timer.value = start(timer.value, T0)
    await settle()
    expect(push.errorMessage.value).toContain('推播暫停服務中')

    fetchMock.mockResolvedValueOnce(Response.json({ error: '伺服器暫時出錯' }, { status: 503 }))
    timer.value = pause(timer.value, T0 + 60_000)
    await settle()
    expect(push.errorMessage.value).toContain('推播伺服器出錯')
    scope.stop()
  })

  it('按開始後馬上鎖螢幕、請求被中斷：顯示沒排上；回到 App 自動重送同一個編號，成功後顯示已排好', async () => {
    const { push, timer, scope } = setup()
    await push.toggle(true)
    fetchMock.mockRejectedValueOnce(new TypeError('Load failed'))
    timer.value = start(timer.value, T0)
    await settle()
    expect(push.alertState.value).toBe('failed')
    expect(push.errorMessage.value).toContain('連不上推播伺服器')

    // 解鎖回到 App
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    const scheduled = calls('/api/schedule')
    expect(scheduled).toHaveLength(2)
    expect(scheduled[1].token).toBe(scheduled[0].token)
    expect(push.alertState.value).toBe('scheduled')
    expect(push.errorMessage.value).toBe('')
    scope.stop()
  })

  it('排好之後回到 App：已確認的提醒不會重複送', async () => {
    const { push, timer, scope } = setup()
    await push.toggle(true)
    timer.value = start(timer.value, T0)
    await settle()
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(calls('/api/schedule')).toHaveLength(1)
    expect(push.alertState.value).toBe('scheduled')
    scope.stop()
  })

  it('按開始的那一刻先準備好訂閱（還在點擊裡），排程請求帶 keepalive', async () => {
    Object.assign(Notification, { permission: 'granted' })
    const { push, timer, scope } = setup({ pushAlerts: true })
    await push.prepare()
    expect(subscribe).toHaveBeenCalledTimes(1)

    timer.value = start(timer.value, T0)
    await settle()
    const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit
    expect(init.keepalive).toBe(true)
    expect(subscribe).toHaveBeenCalledTimes(1)
    scope.stop()
  })
})
