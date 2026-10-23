import { computed, nextTick, ref, type Ref } from 'vue'
import { DURATION_LABELS } from '@/core/format'
import type { DurationKey, Settings } from '@/core/settings'

// 時間鍵盤要改哪一個時長；null 表示鍵盤沒開
export function useDurationEditor(
  settings: Ref<Settings>,
  updateSettings: (patch: Partial<Settings>) => void,
) {
  const editingKey = ref<DurationKey | null>(null)
  // 鍵盤是整個卸載的，原生 <dialog> 不會自己把焦點還回去，要記下是誰打開的
  let opener: HTMLElement | null = null

  const title = computed(() =>
    editingKey.value ? `設定${DURATION_LABELS[editingKey.value]}時間` : '',
  )
  const currentSeconds = computed(() => (editingKey.value ? settings.value[editingKey.value] : 0))

  function openEditor(key: DurationKey): void {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    editingKey.value = key
  }

  function closeEditor(): void {
    if (editingKey.value === null) return
    editingKey.value = null
    const target = opener
    opener = null
    void nextTick(() => target?.focus())
  }

  function confirmEditor(seconds: number): void {
    if (editingKey.value) updateSettings({ [editingKey.value]: seconds })
    closeEditor()
  }

  return { editingKey, title, currentSeconds, openEditor, closeEditor, confirmEditor }
}
