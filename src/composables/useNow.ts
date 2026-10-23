import { onScopeDispose, ref } from 'vue'

// 「現在時間」的單一來源。除了定時更新，回到前景（解鎖手機、切回分頁）時立刻更新，
// 不用等下一次計時器，時間到的提示才不會慢半拍。
export function useNow(intervalMs = 250) {
  const now = ref(Date.now())
  /** 畫面在前景嗎：鎖螢幕、切到別的 App 或分頁時是 false */
  const visible = ref(document.visibilityState !== 'hidden')

  function refresh(): number {
    now.value = Date.now()
    return now.value
  }

  const timer = window.setInterval(refresh, intervalMs)
  // 回到前景時先更新時間、再標成可見，第一個畫面就是正確的時間
  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh()
    visible.value = document.visibilityState !== 'hidden'
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

  return { now, visible, refresh }
}
