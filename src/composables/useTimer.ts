import { computed, ref, watch, type Ref } from 'vue'
import type { Settings } from '@/core/settings'
import { readJson, STORAGE_KEYS, writeJson } from '@/core/storage'
import {
  applySettings,
  pause,
  progress,
  remainingMs,
  resetPhase,
  restoreState,
  selectPhase,
  skip,
  start,
  tick,
  type Phase,
} from '@/core/timer'

export interface TimerHooks {
  /** 某一段時間到了（含重新整理後才發現早就到了） */
  onFinish: (phase: Phase, seconds: number) => void
}

// 把純函式的狀態機接上 Vue：負責「現在時間」、存檔、設定變更
export function useTimer(
  settings: Ref<Settings>,
  clock: { now: Ref<number>; refresh: () => number },
  hooks: TimerHooks,
) {
  const state = ref(restoreState(readJson(STORAGE_KEYS.timer), settings.value))

  const remaining = computed(() => remainingMs(state.value, clock.now.value))
  const ratio = computed(() => progress(state.value, clock.now.value))

  function checkFinished(at: number): void {
    const result = tick(state.value, settings.value, at)
    if (!result.finished) return
    state.value = result.state
    hooks.onFinish(result.finished, result.finishedSeconds)
  }

  // 按鈕操作用「按下那一刻」的時間，不用上一次 tick 的時間，暫停才精準
  function toggle(): void {
    const at = clock.refresh()
    state.value = state.value.status === 'running' ? pause(state.value, at) : start(state.value, at)
  }

  function reset(): void {
    state.value = resetPhase(state.value, settings.value)
  }

  function skipPhase(): void {
    state.value = skip(state.value, settings.value, clock.refresh())
  }

  function choosePhase(phase: Phase): void {
    state.value = selectPhase(state.value, settings.value, phase)
  }

  watch(clock.now, checkFinished, { immediate: true })
  watch(settings, (value) => (state.value = applySettings(state.value, value)), { deep: true })
  watch(state, (value) => writeJson(STORAGE_KEYS.timer, value), { deep: true })

  return { state, remaining, ratio, toggle, reset, skipPhase, choosePhase }
}
