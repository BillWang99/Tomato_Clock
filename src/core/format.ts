import type { DurationKey } from './settings'
import type { Phase, TimerStatus } from './timer'

export const APP_NAME = '像素蕃茄鐘'

export const PHASE_LABELS: Readonly<Record<Phase, string>> = Object.freeze({
  focus: '專注',
  shortBreak: '短休息',
  longBreak: '長休息',
})

export const DURATION_LABELS: Readonly<Record<DurationKey, string>> = Object.freeze({
  focusSeconds: '專注',
  shortBreakSeconds: '短休息',
  longBreakSeconds: '長休息',
})

// 時間到時橫幅上的話：剛結束的是什麼、接下來做什麼
export const FINISH_MESSAGES: Readonly<Record<Phase, string>> = Object.freeze({
  focus: '專注完成！休息一下吧',
  shortBreak: '休息結束，回來專注囉',
  longBreak: '長休息結束，新的一輪開始',
})

/** 剩餘毫秒 → MM:SS。秒數無條件進位：開始那一刻顯示 25:00，真的結束才顯示 00:00 */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** 秒數 → MM:SS，例如 3030 → "50:30" */
export function formatDuration(seconds: number): string {
  return formatClock(seconds * 1000)
}

/** 給人念的時長，例如 3030 → "50 分 30 秒"、1500 → "25 分" */
export function spokenDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return `${rest} 秒`
  return rest === 0 ? `${minutes} 分` : `${minutes} 分 ${rest} 秒`
}

/** 瀏覽器分頁標題：切到別的分頁也看得到倒數 */
export function documentTitle(
  phase: Phase,
  status: TimerStatus,
  remaining: number,
  timeUp: boolean,
): string {
  if (timeUp) return `⏰ 時間到！· ${APP_NAME}`
  if (status === 'running')
    return `${formatClock(remaining)} ${PHASE_LABELS[phase]}中 · ${APP_NAME}`
  if (status === 'paused') return `⏸ ${formatClock(remaining)} · ${APP_NAME}`
  return APP_NAME
}
