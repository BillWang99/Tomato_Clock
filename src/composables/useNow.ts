import { onScopeDispose, ref } from 'vue'

// 「現在時間」的單一來源。除了定時更新，回到前景（解鎖手機、切回分頁）時立刻更新，
// 不用等下一次計時器，時間到的提示才不會慢半拍。
export function useNow(intervalMs = 250) {
  const now = ref(Date.now())

  function refresh(): number {
    now.value = Date.now()
    return now.value
  }

  const timer = window.setInterval(refresh, intervalMs)
  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pageshow', refresh)
  window.addEventListener('focus', refresh)

  onScopeDispose(() => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('pageshow', refresh)
    window.removeEventListener('focus', refresh)
  })

  return { now, refresh }
}
