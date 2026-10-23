import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { RegisterSWOptions } from 'virtual:pwa-register'
import { useAppUpdate } from './useAppUpdate'

// 模擬 vite-plugin-pwa 的 registerSW：記下選項，讓測試決定什麼時候「有新版」
function fakeRegister(registration: Partial<ServiceWorkerRegistration>) {
  let options: RegisterSWOptions = {}
  const updateSW = vi.fn(async () => undefined)
  const register = vi.fn((opts?: RegisterSWOptions) => {
    options = opts ?? {}
    options.onRegisteredSW?.('sw.js', registration as ServiceWorkerRegistration)
    return updateSW
  })
  return { register, updateSW, foundUpdate: () => options.onNeedRefresh?.() }
}

function withServiceWorker(present: boolean) {
  if (present) {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} })
  } else {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker
  }
}

describe('PWA 更新', () => {
  afterEach(() => withServiceWorker(false))

  it('有新版時：顯示更新提示；按「立即更新」才切換成新版', async () => {
    withServiceWorker(true)
    const fake = fakeRegister({ update: vi.fn(async () => ({}) as ServiceWorkerRegistration) })
    const scope = effectScope()
    const updater = scope.run(() => useAppUpdate(fake.register))!
    expect(updater.needRefresh.value).toBe(false)

    fake.foundUpdate()
    expect(updater.needRefresh.value).toBe(true)
    expect(updater.check.value).toBe('available')
    expect(fake.updateSW).not.toHaveBeenCalled()

    await updater.applyUpdate()
    expect(fake.updateSW).toHaveBeenCalledWith(true)
    scope.stop()
  })

  it('按「稍後」：提示先收起來，不會更新', () => {
    withServiceWorker(true)
    const fake = fakeRegister({ update: vi.fn(async () => ({}) as ServiceWorkerRegistration) })
    const scope = effectScope()
    const updater = scope.run(() => useAppUpdate(fake.register))!
    fake.foundUpdate()
    updater.dismiss()
    expect(updater.needRefresh.value).toBe(false)
    expect(fake.updateSW).not.toHaveBeenCalled()
    scope.stop()
  })

  it('設定裡按「檢查更新」：沒有新版 → 已是最新；新版下載中 → 有新版', async () => {
    withServiceWorker(true)
    const registration: Partial<ServiceWorkerRegistration> = {
      update: vi.fn(async () => ({}) as ServiceWorkerRegistration),
    }
    const fake = fakeRegister(registration)
    const scope = effectScope()
    const updater = scope.run(() => useAppUpdate(fake.register))!

    await updater.checkNow()
    expect(registration.update).toHaveBeenCalled()
    expect(updater.check.value).toBe('latest')

    Object.assign(registration, { installing: {} })
    await updater.checkNow()
    expect(updater.check.value).toBe('available')
    scope.stop()
  })

  it('瀏覽器沒有 Service Worker：顯示不支援，不註冊', () => {
    withServiceWorker(false)
    const fake = fakeRegister({})
    const scope = effectScope()
    const updater = scope.run(() => useAppUpdate(fake.register))!
    expect(updater.check.value).toBe('unsupported')
    expect(fake.register).not.toHaveBeenCalled()
    scope.stop()
  })

  it('版本號顯示 package.json 的版本與建置碼', () => {
    const scope = effectScope()
    const updater = scope.run(() => useAppUpdate(fakeRegister({}).register))!
    expect(updater.version).toMatch(/^v\d+\.\d+\.\d+（.+）$/)
    scope.stop()
  })
})
