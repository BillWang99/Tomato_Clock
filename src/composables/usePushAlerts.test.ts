import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings'
import { createInitialState, pause, start, type TimerState } from '@/core/timer'
import { usePushAlerts } from './usePushAlerts'

vi.mock('@/core/pushConfig', () => ({
  PUSH_API_URL: 'https://tomato-push.test',
  VAPID_PUBLIC_KEY: 'BPublicKeyForTest',
  isPushConfigured: () => true,
}))

const T0 = Date.UTC(2026, 9, 24, 9, 0, 0)
const SUBSCRIPTION = {
  endpoint: 'https://web.push.apple.com/device-1',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
}

let fetchMock: ReturnType<typeof vi.fn>
let subscribe: ReturnType<typeof vi.fn>

// 模擬「從主畫面打開的 iPhone App」：有 Service Worker、PushManager、通知權限。
// 每次訂閱拿到一組新的推播位址（device-1、device-2…），退訂後 getSubscription 回 null
function installPushBrowser(permissionAnswer: NotificationPermission = 'granted') {
  let count = 0
  let current: { toJSON: () => typeof SUBSCRIPTION; unsubscribe: () => Promise<boolean> } | null =
    null
  subscribe = vi.fn(async () => {
    count += 1
    const data = { ...SUBSCRIPTION, endpoint: `https://web.push.apple.com/device-${count}` }
    current = {
      toJSON: () => data,
      unsubscribe: async () => {
        current = null
        return true
      },
    }
    return current
  })
  const registration = {
    pushManager: { getSubscription: vi.fn(async () => current), subscribe },
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  })
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal(
    'Notification',
    Object.assign(class {}, {
      permission: 'default',
      requestPermission: vi.fn(async () => permissionAnswer),
    }),
  )
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
}

function setup(initial: Partial<Settings> = {}) {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS, ...initial })
  const timer = ref<TimerState>(createInitialState(settings.value))
  const scope = effectScope()
  const push = scope.run(() =>
    usePushAlerts(settings, (patch) => (settings.value = { ...settings.value, ...patch }), timer),
  )!
  return { settings, timer, push, scope }
}

function calls(path: string) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith(path))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

async function settle() {
  for (let i = 0; i < 10; i++) await nextTick()
  await vi.runAllTimersAsync()
}

describe('鎖螢幕也提醒', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    installPushBrowser()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

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
})
