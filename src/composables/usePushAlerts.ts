import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { cancelPush, PushGoneError, schedulePush, type PushSubscriptionData } from '@/api/push'
import {
  desiredAlert,
  nextPushAction,
  restoreScheduled,
  type ScheduledAlert,
} from '@/core/pushPlan'
import { isPushConfigured, VAPID_PUBLIC_KEY } from '@/core/pushConfig'
import { readJson, STORAGE_KEYS, writeJson } from '@/core/storage'
import type { Settings } from '@/core/settings'
import type { TimerState } from '@/core/timer'
import { isIos, isStandalone } from './devicePlatform'

/**
 * hidden：這個瀏覽器不支援或伺服器還沒設定，設定裡不顯示
 * needsInstall：iPhone 在 Safari 分頁裡，要先加到主畫面
 * denied：使用者拒絕過通知，要到系統設定打開
 * off／on：可以切換
 * working：正在問權限或訂閱中
 */
export type PushStatus = 'hidden' | 'needsInstall' | 'denied' | 'off' | 'on' | 'working'

const READY_TIMEOUT_MS = 10_000

function browserSupportsPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function toBase64Url(buffer: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(buffer))
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

// 推播金鑰換新後，手機上的舊訂閱是用舊公鑰建立的，伺服器用新金鑰發不過去；比對不一樣就重新訂閱
function usesCurrentKey(subscription: PushSubscription): boolean {
  const key = subscription.options?.applicationServerKey
  if (!key) return true // 瀏覽器不提供就沒辦法比對，當作一樣
  return toBase64Url(key) === VAPID_PUBLIC_KEY
}

function toData(subscription: PushSubscription): PushSubscriptionData | null {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }
}

// 開發伺服器沒有 Service Worker，ready 會永遠等不到，所以加逾時
async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('推播只能在正式網站使用')), READY_TIMEOUT_MS),
  )
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

async function currentSubscription(
  createIfMissing: boolean,
  replaceExisting = false,
): Promise<PushSubscriptionData> {
  const registration = await serviceWorkerRegistration()
  let subscription = await registration.pushManager.getSubscription()
  // 伺服器說舊訂閱已失效、或要排新提醒時發現訂閱是換新前的金鑰：退訂後重新訂閱。
  // 只是取消提醒時（createIfMissing=false）不比對金鑰：取消只需要推播位址，不能在這時把訂閱退掉
  const staleKey = createIfMissing && subscription !== null && !usesCurrentKey(subscription)
  if (subscription && (replaceExisting || staleKey)) {
    await subscription.unsubscribe()
    subscription = null
  }
  if (!subscription && createIfMissing) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    })
  }
  const data = subscription ? toData(subscription) : null
  if (!data) throw new Error('推播訂閱失效，請重新打開「鎖螢幕也提醒」')
  return data
}

/**
 * 給畫面看的排程狀態（計時器下方那一行）
 * idle：沒有要排的提醒；sending：正在送給伺服器；scheduled：伺服器確認排好了；failed：沒排上
 */
export type AlertState = 'idle' | 'sending' | 'scheduled' | 'failed'

// iOS 不允許在使用者點擊以外的時機重新訂閱推播（例如換金鑰後要重訂）
function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return '推播需要重新開啟：請到設定把「鎖螢幕也提醒」關掉再打開'
  }
  return error instanceof Error ? error.message : '推播設定失敗'
}

// 鎖螢幕也提醒：開始計時就請伺服器在時間到時發推播，暫停、重設、跳過就取消。
// 推播失敗只顯示一行說明，計時本身完全不受影響。
export function usePushAlerts(
  settings: Ref<Settings>,
  updateSettings: (patch: Partial<Settings>) => void,
  timerState: Ref<TimerState>,
) {
  const supported = isPushConfigured() && browserSupportsPush()
  const working = ref(false)
  const errorMessage = ref('')
  const alertState = ref<AlertState>('idle')
  const permission = ref<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default',
  )

  let subscription: PushSubscriptionData | null = null
  // 伺服器上可能排著的提醒（含「送了但沒確認」）。存在瀏覽器裡：重新整理後才知道要不要重送或取消
  let scheduled: ScheduledAlert | null = restoreScheduled(readJson(STORAGE_KEYS.push))

  function remember(next: ScheduledAlert | null): void {
    scheduled = next
    writeJson(STORAGE_KEYS.push, next)
  }

  const status = computed<PushStatus>(() => {
    if (!isPushConfigured()) return 'hidden'
    if (isIos() && !isStandalone()) return 'needsInstall'
    if (!supported) return 'hidden'
    if (working.value) return 'working'
    if (permission.value === 'denied') return 'denied'
    return settings.value.pushAlerts ? 'on' : 'off'
  })

  function pushReady(): boolean {
    return settings.value.pushAlerts && permission.value === 'granted'
  }

  // 所有跟伺服器、訂閱有關的事排成一列依序做，避免排程和取消的順序亂掉
  let queue: Promise<void> = Promise.resolve()
  function enqueue(task: () => Promise<void>): Promise<void> {
    queue = queue.then(task)
    return queue
  }

  // 把伺服器上的提醒調成「應該」的樣子
  function sync(): Promise<void> {
    return enqueue(async () => {
      const desired = desiredAlert(timerState.value, pushReady(), Date.now())
      const action = nextPushAction(scheduled, desired)
      if (action.type === 'none') {
        alertState.value = desired ? 'scheduled' : 'idle'
        return
      }
      try {
        if (action.type === 'schedule') {
          const { delayMs, phase, token } = action.alert
          alertState.value = 'sending'
          // 送出前先記成「沒確認」：請求到了伺服器但回應遺失時，之後暫停還是會送取消、回到 App 會重送
          remember({ token, confirmed: false })
          subscription ??= await currentSubscription(true)
          try {
            await schedulePush(subscription, delayMs, phase, token)
          } catch (error) {
            if (!(error instanceof PushGoneError)) throw error
            subscription = await currentSubscription(true, true)
            await schedulePush(subscription, delayMs, phase, token)
          }
          remember({ token, confirmed: true })
          alertState.value = 'scheduled'
        } else {
          // 取消成功才忘記；失敗（例如斷網）就留著，下次再取消一次
          subscription ??= await currentSubscription(false)
          await cancelPush(subscription.endpoint, action.token)
          remember(null)
          alertState.value = 'idle'
        }
        // 只有真的送出請求而且成功才清掉錯誤訊息，打開開關失敗的說明不會被蓋掉
        errorMessage.value = ''
      } catch (error) {
        if (action.type === 'schedule') alertState.value = 'failed'
        errorMessage.value = describeError(error)
      }
    })
  }

  /**
   * 按「開始」的那一刻呼叫：趁還在使用者點擊裡先準備好訂閱（iOS 重新訂閱需要點擊），
   * 排程請求才能馬上送出，不會等到使用者已經鎖螢幕才送
   */
  function prepare(): Promise<void> {
    if (!supported || !pushReady() || subscription) return queue
    return enqueue(async () => {
      try {
        subscription ??= await currentSubscription(true)
      } catch (error) {
        errorMessage.value = describeError(error)
      }
    })
  }

  // 必須在使用者點擊時呼叫：iOS 只允許在手勢中詢問通知權限
  async function enable(): Promise<void> {
    if (!supported) return
    working.value = true
    errorMessage.value = ''
    try {
      permission.value = await Notification.requestPermission()
      if (permission.value !== 'granted') return
      subscription = await currentSubscription(true)
      updateSettings({ pushAlerts: true })
    } catch (error) {
      errorMessage.value = describeError(error)
    } finally {
      working.value = false
    }
    await sync()
  }

  async function disable(): Promise<void> {
    updateSettings({ pushAlerts: false })
    await sync()
  }

  function toggle(on: boolean): Promise<void> {
    return on ? enable() : disable()
  }

  if (supported) {
    watch(
      () => [timerState.value.status, timerState.value.endAt, settings.value.pushAlerts],
      () => void sync(),
      { immediate: true },
    )
    // 回到 App、網路恢復時，把上次沒送成功（例如鎖螢幕時被中斷）的提醒補送
    const retry = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    document.addEventListener('visibilitychange', retry)
    window.addEventListener('online', retry)
    window.addEventListener('pageshow', retry)
    onScopeDispose(() => {
      document.removeEventListener('visibilitychange', retry)
      window.removeEventListener('online', retry)
      window.removeEventListener('pageshow', retry)
    })
  }

  return { status, errorMessage, alertState, toggle, prepare }
}
