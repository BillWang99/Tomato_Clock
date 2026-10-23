import { onScopeDispose, ref } from 'vue'

// 讓元件依螢幕寬度、減少動態效果等條件切換；摺疊機開合時會即時更新
export function useMediaQuery(query: string) {
  const list = window.matchMedia(query)
  const matches = ref(list.matches)
  const onChange = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }
  list.addEventListener('change', onChange)
  onScopeDispose(() => list.removeEventListener('change', onChange))
  return matches
}

export function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
