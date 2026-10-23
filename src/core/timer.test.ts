import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from './settings'
import {
  applySettings,
  createInitialState,
  pause,
  progress,
  remainingMs,
  resetPhase,
  restoreState,
  selectPhase,
  skip,
  start,
  tick,
  type TimerState,
} from './timer'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 23, 9, 0, 0)
const settings: Settings = { ...DEFAULT_SETTINGS }

// 跑完目前這一段，回傳下一段的狀態與結果
function finishCurrent(state: TimerState, s: Settings, at: number) {
  const running = start(state, at)
  return tick(running, s, running.endAt as number)
}

describe('計時核心', () => {
  it('初始狀態是專注 25:00、尚未開始', () => {
    const state = createInitialState(settings)
    expect(state.phase).toBe('focus')
    expect(state.status).toBe('idle')
    expect(remainingMs(state, T0)).toBe(25 * MIN)
  })

  it('開始 25 分鐘專注，過 10 分鐘後剩 15:00', () => {
    const running = start(createInitialState(settings), T0)
    expect(remainingMs(running, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(progress(running, T0 + 10 * MIN)).toBeCloseTo(0.4)
  })

  it('跑 10 分鐘暫停、停 3 分鐘再繼續，結束時間往後延 3 分鐘', () => {
    const running = start(createInitialState(settings), T0)
    const paused = pause(running, T0 + 10 * MIN)
    expect(paused.status).toBe('paused')
    expect(remainingMs(paused, T0 + 13 * MIN)).toBe(15 * MIN)

    const resumed = start(paused, T0 + 13 * MIN)
    expect(resumed.endAt).toBe(T0 + 28 * MIN)
  })

  it('鎖屏 26 分鐘後回來：專注已完成、完成數 +1、切到短休息', () => {
    const running = start(createInitialState(settings), T0)
    const result = tick(running, settings, T0 + 26 * MIN)
    expect(result.finished).toBe('focus')
    expect(result.finishedMinutes).toBe(25)
    expect(result.state.phase).toBe('shortBreak')
    expect(result.state.status).toBe('idle')
    expect(result.state.completedInCycle).toBe(1)
    expect(remainingMs(result.state, T0 + 26 * MIN)).toBe(5 * MIN)
  })

  it('時間還沒到時 tick 不會結束；時間到後只回報一次完成', () => {
    const running = start(createInitialState(settings), T0)
    expect(tick(running, settings, T0 + 25 * MIN - 1).finished).toBeNull()

    const first = tick(running, settings, T0 + 25 * MIN)
    expect(first.finished).toBe('focus')
    expect(tick(first.state, settings, T0 + 25 * MIN + 500).finished).toBeNull()
  })

  it('剩餘時間不會變成負數', () => {
    const running = start(createInitialState(settings), T0)
    expect(remainingMs(running, T0 + 99 * MIN)).toBe(0)
    expect(progress(running, T0 + 99 * MIN)).toBe(1)
  })

  it('完成第 4 個專注後接長休息 15:00，長休息完回到專注且重新計數', () => {
    let state = createInitialState(settings)
    let at = T0
    const phases: string[] = []
    for (let i = 0; i < 8; i++) {
      const result = finishCurrent(state, settings, at)
      at = (start(state, at).endAt as number) + 1000
      state = result.state
      phases.push(state.phase)
    }
    expect(phases).toEqual([
      'shortBreak',
      'focus',
      'shortBreak',
      'focus',
      'shortBreak',
      'focus',
      'longBreak',
      'focus',
    ])
    expect(state.completedInCycle).toBe(0)
  })

  it('長休息間隔改成 2：第 2 個專注後就接長休息', () => {
    const s = { ...settings, longBreakInterval: 2 }
    let state = createInitialState(s)
    state = finishCurrent(state, s, T0).state // focus → shortBreak
    state = finishCurrent(state, s, T0).state // shortBreak → focus
    state = finishCurrent(state, s, T0).state // focus → longBreak
    expect(state.phase).toBe('longBreak')
  })

  it('跳過專注：進到短休息，但不算完成', () => {
    const running = start(createInitialState(settings), T0)
    const skipped = skip(running, settings, T0 + MIN)
    expect(skipped.phase).toBe('shortBreak')
    expect(skipped.status).toBe('idle')
    expect(skipped.completedInCycle).toBe(0)
  })

  it('跳過長休息：回到專注並重新計數', () => {
    const inLong: TimerState = {
      ...selectPhase(createInitialState(settings), settings, 'longBreak'),
      completedInCycle: 4,
    }
    const skipped = skip(inLong, settings, T0)
    expect(skipped.phase).toBe('focus')
    expect(skipped.completedInCycle).toBe(0)
  })

  it('開啟自動開始：專注完成後短休息立刻開始，從發現時間到的那一刻起算 5 分鐘', () => {
    const s = { ...settings, autoStartNext: true }
    const running = start(createInitialState(s), T0)
    const result = tick(running, s, T0 + 40 * MIN)
    expect(result.state.status).toBe('running')
    expect(result.state.endAt).toBe(T0 + 45 * MIN)
  })

  it('手動切換到長休息：15:00、未開始、不改完成數', () => {
    const state = { ...createInitialState(settings), completedInCycle: 2 }
    const selected = selectPhase(state, settings, 'longBreak')
    expect(selected.phase).toBe('longBreak')
    expect(selected.status).toBe('idle')
    expect(remainingMs(selected, T0)).toBe(15 * MIN)
    expect(selected.completedInCycle).toBe(2)
  })

  it('重設本段：回到這一段的開頭', () => {
    const running = start(createInitialState(settings), T0)
    const reset = resetPhase(pause(running, T0 + 7 * MIN), settings)
    expect(reset.status).toBe('idle')
    expect(remainingMs(reset, T0)).toBe(25 * MIN)
  })

  it('設定改成 50 分鐘：還沒開始的套用新時長，進行中的不受影響', () => {
    const s = { ...settings, focusMinutes: 50 }
    expect(remainingMs(applySettings(createInitialState(settings), s), T0)).toBe(50 * MIN)

    const running = start(createInitialState(settings), T0)
    expect(applySettings(running, s)).toBe(running)
  })

  it('進行中改設定，完成時統計記的是實際跑的 25 分鐘', () => {
    const running = start(createInitialState(settings), T0)
    const changed = applySettings(running, { ...settings, focusMinutes: 50 })
    expect(tick(changed, settings, T0 + 25 * MIN).finishedMinutes).toBe(25)
  })
})

describe('重新整理後恢復', () => {
  it('進行中的計時恢復後，剩餘時間照樣以結束時間計算', () => {
    const running = start(createInitialState(settings), T0)
    const restored = restoreState(JSON.parse(JSON.stringify(running)), settings)
    expect(restored).toEqual(running)
    expect(remainingMs(restored, T0 + 5 * MIN)).toBe(20 * MIN)
  })

  it('重新整理時早就超過結束時間：恢復後第一次 tick 就算完成', () => {
    const running = start(createInitialState(settings), T0)
    const restored = restoreState(JSON.parse(JSON.stringify(running)), settings)
    expect(tick(restored, settings, T0 + 60 * MIN).finished).toBe('focus')
  })

  it('壞掉或缺欄位的資料：從頭開始，不會當掉', () => {
    const initial = createInitialState(settings)
    expect(restoreState(null, settings)).toEqual(initial)
    expect(restoreState('壞資料', settings)).toEqual(initial)
    expect(restoreState({ phase: 'lunch', status: 'idle' }, settings)).toEqual(initial)
    expect(
      restoreState(
        { phase: 'focus', status: 'running', durationMs: 1, remainingMs: 1, completedInCycle: 0 },
        settings,
      ),
    ).toEqual(initial)
  })
})
