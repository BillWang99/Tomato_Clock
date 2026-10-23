import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings'
import { useSound } from './useSound'

// 模擬瀏覽器的聲音系統：記下建立了幾個音（oscillator）
let oscillators = 0
function installAudio(initialState: AudioContextState, resume: () => Promise<void>) {
  class FakeAudioContext {
    state: AudioContextState = initialState
    currentTime = 0
    destination = {}
    resume = vi.fn(async () => {
      await resume()
      this.state = 'running'
    })
    close = vi.fn(async () => undefined)
    createOscillator() {
      oscillators += 1
      return {
        type: '',
        frequency: { value: 0 },
        connect: (n: unknown) => n,
        start() {},
        stop() {},
      }
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect: (n: unknown) => n,
      }
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)
  const session = { type: 'auto' }
  Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session })
  return session
}

function setup(patch: Partial<Settings> = {}) {
  const scope = effectScope()
  const sound = scope.run(() => useSound(ref({ ...DEFAULT_SETTINGS, ...patch })))!
  return { sound, scope }
}

describe('提示音', () => {
  afterEach(() => {
    oscillators = 0
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('點過開始（解鎖）後時間到：響提示音，並把 iPhone 的聲音類型設成 ambient（尊重靜音開關）', async () => {
    const session = installAudio('suspended', async () => undefined)
    const { sound, scope } = setup()
    await sound.unlock()
    expect(session.type).toBe('ambient')
    sound.play('finish')
    expect(oscillators).toBeGreaterThan(0)
    scope.stop()
  })

  it('設定關掉提示音：不響', async () => {
    installAudio('suspended', async () => undefined)
    const { sound, scope } = setup({ soundOn: false })
    await sound.unlock()
    sound.play('finish')
    expect(oscillators).toBe(0)
    scope.stop()
  })

  it('從沒點過開始（聲音系統沒解鎖）：不響', () => {
    installAudio('suspended', async () => undefined)
    const { sound, scope } = setup()
    sound.play('finish')
    expect(oscillators).toBe(0)
    scope.stop()
  })

  it('聲音系統暫停中、1 秒內恢復不了：不響，之後也不會補播', async () => {
    vi.useFakeTimers()
    let release: () => void = () => undefined
    installAudio('suspended', () => new Promise<void>((resolve) => (release = resolve)))
    const { sound, scope } = setup()
    void sound.unlock() // 解鎖卡住（模擬 iOS 不放行）
    sound.play('finish')
    await vi.advanceTimersByTimeAsync(1500)
    release() // 很久之後才恢復
    await vi.advanceTimersByTimeAsync(100)
    expect(oscillators).toBe(0)
    scope.stop()
  })
})
