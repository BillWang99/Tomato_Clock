import { computed, ref, watch, type Ref } from 'vue'
import { cancelPush, PushGoneError, schedulePush, type PushSubscriptionData } from '@/api/push'
import { desiredAlert, nextPushAction } from '@/core/pushPlan'
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
  // 伺服器說舊訂閱已失效：退訂後重新訂閱，拿一組新的推播位址
  if (subscription && replaceExisting) {
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
  const permission = ref<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default',
  )

  let subscription: PushSubscriptionData | null = null
  // 伺服器上目前排著的提醒編號。存在瀏覽器裡：重新整理後才知道要不要取消
  const stored = readJson(STORAGE_KEYS.push)
  let scheduledToken: string | null = typeof stored === 'string' ? stored : null

  function rememberToken(token: string | null): void {
    scheduledToken = token
    writeJson(STORAGE_KEYS.push, token)
  }

  const status = computed<PushStatus>(() => {
    if (!isPushConfigured()) return 'hidden'
    if (isIos() && !isStandalone()) return 'needsInstall'
    if (!supported) return 'hidden'
    if (working.value) return 'working'
    if (permission.value === 'denied') return 'denied'
    return settings.value.pushAlerts ? 'on' : 'off'
  })

  // 把伺服器上的提醒調成「應該」的樣子；同一時間只跑一個，避免排程和取消的順序亂掉
  let syncing: Promise<void> = Promise.resolve()
  function sync(): Promise<void> {
    syncing = syncing.then(async () => {
      const enabled = settings.value.pushAlerts && permission.value === 'granted'
      const action = nextPushAction(
        scheduledToken,
        desiredAlert(timerState.value, enabled, Date.now()),
      )
      if (action.type === 'none') return
      try {
        if (action.type === 'schedule') {
          const { delayMs, phase, token } = action.alert
          // 送出前就先記住：請求到了伺服器但回應遺失時，之後暫停還是會送取消
          rememberToken(token)
          subscription ??= await currentSubscription(true)
          try {
            await schedulePush(subscription, delayMs, phase, token)
          } catch (error) {
            if (!(error instanceof PushGoneError)) throw error
            subscription = await currentSubscription(true, true)
            await schedulePush(subscription, delayMs, phase, token)
          }
        } else {
          // 取消成功才忘記編號；失敗（例如斷網）就留著，下次狀態改變時再取消一次
          subscription ??= await currentSubscription(false)
          await cancelPush(subscription.endpoint, action.token)
          rememberToken(null)
        }
        // 只有真的送出請求而且成功才清掉錯誤訊息，打開開關失敗的說明不會被蓋掉
        errorMessage.value = ''
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : '推播設定失敗'
      }
    })
    return syncing
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
      errorMessage.value = error instanceof Error ? error.message : '推播設定失敗'
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
  }

  return { status, errorMessage, toggle }
}
