// 蕃茄鐘計時狀態機（純函式，不碰畫面、不碰瀏覽器 API）。
// 計時一律以「結束時間戳記 endAt」計算，不累加 setInterval：
// 手機切到背景、鎖螢幕時瀏覽器會暫停計時器，但回來時用 now 與 endAt 相減，時間仍然正確。

import type { DurationKey, Settings } from './settings'

export type Phase = 'focus' | 'shortBreak' | 'longBreak'
export type TimerStatus = 'idle' | 'running' | 'paused'

export const PHASES: readonly Phase[] = ['focus', 'shortBreak', 'longBreak']

export interface TimerState {
  phase: Phase
  status: TimerStatus
  /** 這一段的總長度（開始後改設定不影響進行中的這一段） */
  durationMs: number
  /** idle、paused 時的剩餘時間；running 時以 endAt 為準 */
  remainingMs: number
  /** 只有 running 時有值 */
  endAt: number | null
  /** 本輪已完成幾個專注，用來決定下一次休息是不是長休息 */
  completedInCycle: number
}

export interface TickResult {
  state: TimerState
  /** 這次 tick 剛好結束的階段；沒有結束就是 null */
  finished: Phase | null
  /** 剛結束的階段實際長度（秒），給今日統計用 */
  finishedSeconds: number
}

/** 每個階段對應哪一個時長設定 */
export const PHASE_DURATION_KEYS: Readonly<Record<Phase, DurationKey>> = Object.freeze({
  focus: 'focusSeconds',
  shortBreak: 'shortBreakSeconds',
  longBreak: 'longBreakSeconds',
})

export function phaseDurationMs(phase: Phase, settings: Settings): number {
  return settings[PHASE_DURATION_KEYS[phase]] * 1000
}

export function createInitialState(settings: Settings): TimerState {
  return idleAt('focus', settings, 0)
}

function idleAt(phase: Phase, settings: Settings, completedInCycle: number): TimerState {
  const durationMs = phaseDurationMs(phase, settings)
  return {
    phase,
    status: 'idle',
    durationMs,
    remainingMs: durationMs,
    endAt: null,
    completedInCycle,
  }
}

export function remainingMs(state: TimerState, now: number): number {
  if (state.status === 'running' && state.endAt !== null) return Math.max(0, state.endAt - now)
  return state.remainingMs
}

/** 0 = 剛開始，1 = 時間到 */
export function progress(state: TimerState, now: number): number {
  if (state.durationMs <= 0) return 1
  return Math.min(1, Math.max(0, 1 - remainingMs(state, now) / state.durationMs))
}

export function start(state: TimerState, now: number): TimerState {
  if (state.status === 'running') return state
  return { ...state, status: 'running', endAt: now + state.remainingMs }
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') return state
  return { ...state, status: 'paused', remainingMs: remainingMs(state, now), endAt: null }
}

/** 重設本段：回到這一段的開頭，用目前設定的時長 */
export function resetPhase(state: TimerState, settings: Settings): TimerState {
  return idleAt(state.phase, settings, state.completedInCycle)
}

// 不管是休完、跳過還是手動切走，離開長休息就代表新的一輪開始
function cycleAfterLeaving(phase: Phase, completedInCycle: number): number {
  return phase === 'longBreak' ? 0 : completedInCycle
}

/** 手動切換分頁：直接跳到指定階段，不計入完成數 */
export function selectPhase(state: TimerState, settings: Settings, phase: Phase): TimerState {
  if (phase === state.phase) return resetPhase(state, settings)
  return idleAt(phase, settings, cycleAfterLeaving(state.phase, state.completedInCycle))
}

// 專注完成後，累積到 longBreakInterval 個就接長休息；休息完一律回到專注
export function nextPhase(phase: Phase, completedInCycle: number, settings: Settings): Phase {
  if (phase !== 'focus') return 'focus'
  const isLong = completedInCycle > 0 && completedInCycle % settings.longBreakInterval === 0
  return isLong ? 'longBreak' : 'shortBreak'
}

function enterPhase(
  phase: Phase,
  completedInCycle: number,
  settings: Settings,
  now: number,
): TimerState {
  const idle = idleAt(phase, settings, completedInCycle)
  return settings.autoStartNext ? start(idle, now) : idle
}

/** 跳過本段：進到下一段，但不算完成（不加蕃茄數） */
export function skip(state: TimerState, settings: Settings, now: number): TimerState {
  const completed = cycleAfterLeaving(state.phase, state.completedInCycle)
  const next = nextPhase(state.phase, completed, settings)
  return enterPhase(next, completed, settings, now)
}

/** 每次畫面更新或回到前景時呼叫：時間到了就切到下一段，並回報剛完成的階段 */
export function tick(state: TimerState, settings: Settings, now: number): TickResult {
  const notFinished = { state, finished: null, finishedSeconds: 0 }
  if (state.status !== 'running' || state.endAt === null || now < state.endAt) return notFinished

  const finished = state.phase
  const finishedSeconds = Math.round(state.durationMs / 1000)
  const completed =
    finished === 'focus'
      ? state.completedInCycle + 1
      : cycleAfterLeaving(finished, state.completedInCycle)

  // 下一段從「發現時間到的這一刻」開始，不從 endAt 開始：
  // 鎖屏半小時回來，不該發現自動開始的休息早就結束了
  const next = nextPhase(finished, completed, settings)
  return { state: enterPhase(next, completed, settings, now), finished, finishedSeconds }
}

/** 設定改變時：還沒開始的這一段套用新時長；進行中或暫停中的不動 */
export function applySettings(state: TimerState, settings: Settings): TimerState {
  if (state.status !== 'idle') return state
  return idleAt(state.phase, settings, state.completedInCycle)
}

/** 從 localStorage 讀回來的資料一律經過這裡；格式不對就從頭開始 */
export function restoreState(raw: unknown, settings: Settings): TimerState {
  const fallback = createInitialState(settings)
  if (typeof raw !== 'object' || raw === null) return fallback
  const s = raw as Record<string, unknown>

  const phase = PHASES.includes(s.phase as Phase) ? (s.phase as Phase) : null
  const status = ['idle', 'running', 'paused'].includes(s.status as string)
    ? (s.status as TimerStatus)
    : null
  const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
  if (!phase || !status || !isCount(s.durationMs) || !isCount(s.remainingMs)) return fallback
  if (!isCount(s.completedInCycle)) return fallback
  if (status === 'running' && !isCount(s.endAt)) return fallback

  const state: TimerState = {
    phase,
    status,
    durationMs: s.durationMs,
    remainingMs: Math.min(s.remainingMs, s.durationMs),
    endAt: status === 'running' ? (s.endAt as number) : null,
    completedInCycle: Math.floor(s.completedInCycle),
  }
  return status === 'idle' ? applySettings(state, settings) : state
}
