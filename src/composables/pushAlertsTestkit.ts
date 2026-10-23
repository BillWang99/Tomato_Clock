// 推播測試共用的模擬環境（不是測試檔）。使用的測試檔要自己 vi.mock('@/core/pushConfig')。
import { afterEach, beforeEach, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings'
import { createInitialState, type TimerState } from '@/core/timer'
import { usePushAlerts } from './usePushAlerts'

export const T0 = Date.UTC(2026, 9, 24, 9, 0, 0)
export const SUBSCRIPTION = {
  endpoint: 'https://web.push.apple.com/device-1',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
}

export let fetchMock: ReturnType<typeof vi.fn>
export let subscribe: ReturnType<typeof vi.fn>

// 模擬「從主畫面打開的 iPhone App」：有 Service Worker、PushManager、通知權限。
// 每次訂閱拿到一組新的推播位址（device-1、device-2…），退訂後 getSubscription 回 null
export function installPushBrowser(permissionAnswer: NotificationPermission = 'granted') {
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

export function setup(initial: Partial<Settings> = {}) {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS, ...initial })
  const timer = ref<TimerState>(createInitialState(settings.value))
  const scope = effectScope()
  const push = scope.run(() =>
    usePushAlerts(settings, (patch) => (settings.value = { ...settings.value, ...patch }), timer),
  )!
  return { settings, timer, push, scope }
}

export function calls(path: string) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith(path))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

export async function settle() {
  for (let i = 0; i < 10; i++) await nextTick()
  await vi.runAllTimersAsync()
}

// 每個測試前：清空瀏覽器資料、固定時間、裝好模擬的推播環境；測試後還原
export function usePushTestHooks(): void {
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
}
