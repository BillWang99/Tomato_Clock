import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { useReducedMotion } from './useMediaQuery'

/** 捲動超過 80 px，或捲過「可以捲的距離」的一半（取比較小的）就顯示「回到最上方」：內容只多一點點也找得到回去的路 */
const BACK_TO_TOP_PX = 80
const BACK_TO_TOP_RATIO = 0.5
/** 離底部 4 px 以內就算到底了（避免小數點誤差） */
const BOTTOM_TOLERANCE = 4

// 捲動區的狀態：下面還有沒有內容（給「往下還有」提示）、要不要顯示「回到最上方」。
// 內容長度會變（例如打開提示音才出現音量），所以除了捲動，也監看大小變化
export function useScrollHints(viewport: Ref<HTMLElement | null>) {
  /** 內容比可見範圍長（需要捲動） */
  const scrollable = ref(false)
  const canScrollDown = ref(false)
  const showBackToTop = ref(false)
  const reducedMotion = useReducedMotion()
  let observer: ResizeObserver | null = null

  function update(): void {
    const el = viewport.value
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    scrollable.value = scrollHeight > clientHeight + BOTTOM_TOLERANCE
    canScrollDown.value = scrollTop + clientHeight < scrollHeight - BOTTOM_TOLERANCE
    const maxScroll = scrollHeight - clientHeight
    showBackToTop.value =
      scrollable.value && scrollTop > Math.min(BACK_TO_TOP_PX, maxScroll * BACK_TO_TOP_RATIO)
  }

  function scrollToTop(): void {
    viewport.value?.scrollTo({ top: 0, behavior: reducedMotion.value ? 'auto' : 'smooth' })
  }

  onMounted(() => {
    const el = viewport.value
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update)
      observer.observe(el)
      // 要連 padding 一起看：需要捲動時內容底部會多留白，那也會改變可以捲的長度
      for (const child of el.children) observer.observe(child, { box: 'border-box' })
    }
    update()
  })

  onBeforeUnmount(() => {
    viewport.value?.removeEventListener('scroll', update)
    observer?.disconnect()
  })

  return { scrollable, canScrollDown, showBackToTop, scrollToTop, update }
}
