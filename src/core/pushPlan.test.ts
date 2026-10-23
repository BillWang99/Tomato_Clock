import { describe, expect, it } from 'vitest'
import { desiredAlert, nextPushAction } from './pushPlan'
import { DEFAULT_SETTINGS } from './settings'
import { createInitialState, pause, start, tick } from './timer'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 24, 9, 0, 0)
const settings = { ...DEFAULT_SETTINGS }

describe('什麼時候該排推播提醒', () => {
  it('推播開著、開始 25 分鐘專注 → 排一個 25 分鐘後的專注提醒，編號是結束時間', () => {
    const running = start(createInitialState(settings), T0)
    expect(desiredAlert(running, true, T0)).toEqual({
      token: String(T0 + 25 * MIN),
      phase: 'focus',
      delayMs: 25 * MIN,
    })
  })

  it('推播關著、還沒開始、暫停中：都不該有提醒', () => {
    const running = start(createInitialState(settings), T0)
    expect(desiredAlert(running, false, T0)).toBeNull()
    expect(desiredAlert(createInitialState(settings), true, T0)).toBeNull()
    expect(desiredAlert(pause(running, T0 + MIN), true, T0 + MIN)).toBeNull()
  })

  it('剩不到 1 秒：交給畫面自己提醒，不排推播', () => {
    const running = start(createInitialState(settings), T0)
    expect(desiredAlert(running, true, T0 + 25 * MIN - 999)).toBeNull()
  })
})

describe('伺服器上的提醒要怎麼調整', () => {
  it('開始 → 排；暫停 → 取消；3 分鐘後繼續 → 用新編號再排一次', () => {
    const running = start(createInitialState(settings), T0)
    const first = nextPushAction(null, desiredAlert(running, true, T0))
    expect(first.type).toBe('schedule')
    const firstToken = first.type === 'schedule' ? first.alert.token : ''

    const paused = pause(running, T0 + 10 * MIN)
    expect(nextPushAction(firstToken, desiredAlert(paused, true, T0 + 10 * MIN))).toEqual({
      type: 'cancel',
      token: firstToken,
    })

    const resumed = start(paused, T0 + 13 * MIN)
    const again = nextPushAction(null, desiredAlert(resumed, true, T0 + 13 * MIN))
    expect(again).toEqual({
      type: 'schedule',
      alert: { token: String(T0 + 28 * MIN), phase: 'focus', delayMs: 15 * MIN },
    })
  })

  it('同一段計時持續進行（每秒 tick）：已經排過就不重複呼叫伺服器', () => {
    const running = start(createInitialState(settings), T0)
    const token = String(T0 + 25 * MIN)
    expect(nextPushAction(token, desiredAlert(running, true, T0 + 5_000))).toEqual({ type: 'none' })
  })

  it('App 開著時專注結束（沒有自動開始）→ 取消剛才的提醒，避免又跳一次通知', () => {
    const running = start(createInitialState(settings), T0)
    const token = String(T0 + 25 * MIN)
    const finished = tick(running, settings, T0 + 25 * MIN).state
    expect(nextPushAction(token, desiredAlert(finished, true, T0 + 25 * MIN))).toEqual({
      type: 'cancel',
      token,
    })
  })

  it('有自動開始：專注結束後直接排短休息 5 分鐘的提醒（新的取代舊的）', () => {
    const auto = { ...settings, autoStartNext: true }
    const running = start(createInitialState(auto), T0)
    const next = tick(running, auto, T0 + 25 * MIN).state
    expect(nextPushAction(String(T0 + 25 * MIN), desiredAlert(next, true, T0 + 25 * MIN))).toEqual({
      type: 'schedule',
      alert: { token: String(T0 + 30 * MIN), phase: 'shortBreak', delayMs: 5 * MIN },
    })
  })
})
