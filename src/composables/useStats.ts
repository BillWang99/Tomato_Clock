import { computed, ref, watch, type Ref } from 'vue'
import { localDateKey, recordFocus, restoreStats, statsForToday } from '@/core/stats'
import { readJson, STORAGE_KEYS, writeJson } from '@/core/storage'

export function useStats(now: Ref<number>) {
  const today = computed(() => localDateKey(now.value))
  const stored = ref(restoreStats(readJson(STORAGE_KEYS.stats), today.value))

  // 畫面一直開著跨過午夜時，數字也要自動歸零
  const todayStats = computed(() => statsForToday(stored.value, today.value))

  function recordFocusMinutes(minutes: number): void {
    stored.value = recordFocus(stored.value, today.value, minutes)
  }

  watch(stored, (value) => writeJson(STORAGE_KEYS.stats, value), { deep: true })

  return { todayStats, recordFocusMinutes }
}
