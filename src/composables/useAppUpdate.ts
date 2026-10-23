import { onScopeDispose, ref } from 'vue'
import { registerSW as defaultRegisterSW } from 'virtual:pwa-register'

/**
 * idle：還沒檢查；checking：檢查中；latest：已經是最新版；available：有新版可以更新；
 * unsupported：這個瀏覽器沒有 Service Worker（不會有離線與更新功能）
 */
export type UpdateCheck = 'idle' | 'checking' | 'latest' | 'available' | 'unsupported'

type RegisterSW = typeof defaultRegisterSW

/** App 一直開著（例如開了螢幕常亮）時，每小時自己檢查一次有沒有新版 */
const CHECK_INTERVAL_MS = 60 * 60_000

export const APP_VERSION = `v${__APP_VERSION__}（${__BUILD_ID__}）`

// 有新版時不自動換，先問使用者：按「立即更新」才重新載入成新版。
// 計時狀態存在 localStorage，更新後會從原本的進度繼續
export function useAppUpdate(registerSW: RegisterSW = defaultRegisterSW) {
  const supported = 'serviceWorker' in navigator
  const needRefresh = ref(false)
  const check = ref<UpdateCheck>(supported ? 'idle' : 'unsupported')
  let registration: ServiceWorkerRegistration | undefined
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined

  if (supported) {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        needRefresh.value = true
        check.value = 'available'
      },
      onRegisteredSW(_url, reg) {
        registration = reg
      },
    })
  }

  async function checkNow(): Promise<void> {
    if (!registration) return
    check.value = 'checking'
    try {
      await registration.update()
    } catch {
      // 沒網路時檢查不到，當作沒有新版
    }
    // 新版下載中（installing）或下載好了在等（waiting），都算有新版
    const found = needRefresh.value || Boolean(registration.installing || registration.waiting)
    check.value = found ? 'available' : 'latest'
  }

  async function applyUpdate(): Promise<void> {
    needRefresh.value = false
    await updateSW?.(true)
  }

  function dismiss(): void {
    needRefresh.value = false
  }

  // 回到 App 時也檢查一次：主畫面的 App 常常一直留在背景，不會重新打開
  const onVisible = () => {
    if (document.visibilityState === 'visible') void registration?.update().catch(() => undefined)
  }
  const timer = window.setInterval(onVisible, CHECK_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisible)
  onScopeDispose(() => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })

  return { needRefresh, check, checkNow, applyUpdate, dismiss, version: APP_VERSION }
}
