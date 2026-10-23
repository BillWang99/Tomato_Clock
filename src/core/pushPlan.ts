// 推播提醒的規則（純函式）：依目前計時狀態，伺服器上「應該」排著哪一個提醒。
// 只有「推播開著、正在計時、離結束還有 1 秒以上」才需要；其他情況一律不該有提醒。

import { remainingMs, type Phase, type TimerState } from './timer'

export interface DesiredAlert {
  /** 這次計時的編號：同一段計時 endAt 不變，暫停再繼續 endAt 會變，就是新的提醒 */
  token: string
  phase: Phase
  delayMs: number
}

/** 伺服器只接受 1 秒以上的提醒；剩不到 1 秒就交給畫面自己提醒 */
const MIN_DELAY_MS = 1000

export function desiredAlert(
  state: TimerState,
  enabled: boolean,
  now: number,
): DesiredAlert | null {
  if (!enabled || state.status !== 'running' || state.endAt === null) return null
  const delayMs = remainingMs(state, now)
  if (delayMs < MIN_DELAY_MS) return null
  return { token: String(state.endAt), phase: state.phase, delayMs: Math.round(delayMs) }
}

export type PushAction =
  { type: 'none' } | { type: 'schedule'; alert: DesiredAlert } | { type: 'cancel'; token: string }

/**
 * 比對「伺服器上排著的」與「應該排著的」，決定要做什麼。
 * 排新的會直接取代舊的（伺服器每支手機只留一筆），所以換提醒不用先取消。
 */
export function nextPushAction(
  scheduledToken: string | null,
  desired: DesiredAlert | null,
): PushAction {
  if (desired) {
    if (desired.token === scheduledToken) return { type: 'none' }
    return { type: 'schedule', alert: desired }
  }
  return scheduledToken ? { type: 'cancel', token: scheduledToken } : { type: 'none' }
}
