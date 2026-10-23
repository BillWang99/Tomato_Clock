import { computed, ref, shallowRef } from 'vue'
import { isAndroid, isIos, isStandalone } from './devicePlatform'

/**
 * installed：已經從主畫面／App 打開，不用再裝
 * native：瀏覽器提供安裝視窗（Android Chrome、電腦版 Chrome／Edge），按一下就跳出來
 * iosGuide：iPhone／iPad 不能用程式叫出安裝，改顯示「分享 → 加入主畫面」的圖解
 * androidGuide：Android 但瀏覽器沒有安裝視窗，改顯示「選單 → 安裝」的圖解
 * hidden：其他瀏覽器（例如電腦版 Firefox）沒有安裝功能，不顯示按鈕
 */
export type InstallMode = 'installed' | 'native' | 'iosGuide' | 'androidGuide' | 'hidden'

export type GuidePlatform = 'ios' | 'android'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// 瀏覽器的「可以安裝」通知可能在頁面一載入就發出，比 Vue 畫面掛上去還早，
// 所以在模組載入時就開始接，存起來等使用者按按鈕
const deferredPrompt = shallowRef<BeforeInstallPromptEvent | null>(null)
const installedNow = ref(false)

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // 不要讓瀏覽器自己跳橫幅，交給我們的按鈕
    deferredPrompt.value = event as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installedNow.value = true
    deferredPrompt.value = null
  })
}

export function useInstallPrompt() {
  const standalone = isStandalone()
  const guidePlatform = ref<GuidePlatform | null>(null)

  const mode = computed<InstallMode>(() => {
    if (standalone || installedNow.value) return 'installed'
    if (deferredPrompt.value) return 'native'
    if (isIos()) return 'iosGuide'
    if (isAndroid()) return 'androidGuide'
    return 'hidden'
  })

  const available = computed(() => mode.value !== 'installed' && mode.value !== 'hidden')

  async function install(): Promise<void> {
    const event = deferredPrompt.value
    if (mode.value === 'native' && event) {
      // 安裝視窗每個通知只能叫一次，用完就丟
      deferredPrompt.value = null
      await event.prompt()
      const { outcome } = await event.userChoice
      if (outcome === 'accepted') installedNow.value = true
      return
    }
    if (mode.value === 'iosGuide') guidePlatform.value = 'ios'
    else if (mode.value === 'androidGuide') guidePlatform.value = 'android'
  }

  function closeGuide(): void {
    guidePlatform.value = null
  }

  return { mode, available, guidePlatform, install, closeGuide }
}
