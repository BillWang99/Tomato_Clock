import { ref, watch } from 'vue'
import { normalizeSettings, type Settings } from '@/core/settings'
import { readJson, STORAGE_KEYS, writeJson } from '@/core/storage'

export function useSettings() {
  const settings = ref<Settings>(normalizeSettings(readJson(STORAGE_KEYS.settings)))

  // 每次只改一個欄位，也要整份再檢查一次，避免存進不合法的值
  function updateSettings(patch: Partial<Settings>): void {
    settings.value = normalizeSettings({ ...settings.value, ...patch })
  }

  watch(settings, (value) => writeJson(STORAGE_KEYS.settings, value), { deep: true })

  return { settings, updateSettings }
}
