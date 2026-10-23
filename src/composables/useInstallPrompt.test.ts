import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 Version/18.4 Safari/604.1',
  desktopFirefox:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15.0; rv:140.0) Gecko/20100101 Firefox/140.0',
}

function useDevice(userAgent: string, standalone = false) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: standalone && query.includes('standalone'),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  )
}

// 模擬 Chrome 發出的「可以安裝」通知
function fireInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome }),
  })
  window.dispatchEvent(event)
  return event
}

// 每個測試重新載入模組：安裝通知是在模組載入時開始接收的
async function load() {
  vi.resetModules()
  const { useInstallPrompt } = await import('./useInstallPrompt')
  return useInstallPrompt
}

describe('安裝到裝置', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('Android Chrome 發出安裝通知：按「安裝」跳出系統安裝視窗，接受後按鈕消失', async () => {
    useDevice(UA.androidChrome)
    const useInstallPrompt = await load()
    const event = fireInstallPrompt('accepted')
    const installer = useInstallPrompt()
    expect(event.defaultPrevented).toBe(true)
    expect(installer.mode.value).toBe('native')

    await installer.install()
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(installer.mode.value).toBe('installed')
    expect(installer.available.value).toBe(false)
  })

  it('iPhone Safari：沒辦法用程式安裝，按「安裝」打開「加入主畫面」圖解', async () => {
    useDevice(UA.iphoneSafari)
    const installer = (await load())()
    expect(installer.mode.value).toBe('iosGuide')
    await installer.install()
    expect(installer.guidePlatform.value).toBe('ios')
    installer.closeGuide()
    expect(installer.guidePlatform.value).toBeNull()
  })

  it('已經從主畫面打開：不顯示安裝按鈕', async () => {
    useDevice(UA.iphoneSafari, true)
    const installer = (await load())()
    expect(installer.mode.value).toBe('installed')
    expect(installer.available.value).toBe(false)
  })

  it('電腦版 Firefox（沒有安裝功能）：不顯示安裝按鈕', async () => {
    useDevice(UA.desktopFirefox)
    const installer = (await load())()
    expect(installer.available.value).toBe(false)
  })

  it('使用者在安裝視窗按取消：還沒安裝，Android 改提供選單安裝的圖解', async () => {
    useDevice(UA.androidChrome)
    const useInstallPrompt = await load()
    fireInstallPrompt('dismissed')
    const installer = useInstallPrompt()
    await installer.install()
    expect(installer.mode.value).toBe('androidGuide')
    await installer.install()
    expect(installer.guidePlatform.value).toBe('android')
  })
})
