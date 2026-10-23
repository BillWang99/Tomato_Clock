import { onScopeDispose, watch, type Ref } from 'vue'

// 計時中不讓手機自動鎖定。瀏覽器切到背景時系統會自動釋放，回到前景要重新申請。
export function useWakeLock(active: Ref<boolean>) {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  let sentinel: WakeLockSentinel | null = null
  let requesting = false

  async function sync(): Promise<void> {
    if (!supported || requesting) return
    const wanted = active.value && document.visibilityState === 'visible'
    if (wanted && !sentinel) {
      requesting = true
      try {
        sentinel = await navigator.wakeLock.request('screen')
        sentinel.addEventListener('release', () => (sentinel = null))
      } catch {
        sentinel = null // 省電模式或系統拒絕時就算了，不打擾使用者
      } finally {
        requesting = false
      }
      if (!active.value) void sync()
    } else if (!wanted && sentinel) {
      const current = sentinel
      sentinel = null
      await current.release().catch(() => undefined)
    }
  }

  const onVisibility = () => void sync()
  document.addEventListener('visibilitychange', onVisibility)
  watch(active, () => void sync(), { immediate: true })
  onScopeDispose(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    void sentinel?.release().catch(() => undefined)
  })

  return { supported }
}
