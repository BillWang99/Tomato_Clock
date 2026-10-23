import { onScopeDispose, type Ref } from 'vue'
import type { Settings } from '@/core/settings'

// 只有一種聲音：時間到的提示。計時中（開始、暫停）完全不出聲，讓使用者專注
export type SoundCue = 'finish'

type Note = readonly [frequency: number, seconds: number]

// 8-bit 音效用方波即時合成，不放音檔，網頁小、離線也能響
const CUES: Readonly<Record<SoundCue, readonly Note[]>> = Object.freeze({
  finish: [
    [523.25, 0.11],
    [659.25, 0.11],
    [783.99, 0.11],
    [1046.5, 0.22],
    [0, 0.12],
    [783.99, 0.11],
    [1046.5, 0.32],
  ],
})

// 方波很刺耳，音量滑到最大也只用到四分之一
const MAX_GAIN = 0.25
/** 聲音系統暫停中（例如剛回到前景）時，最多等它恢復這麼久；等不到就不響，不會晚很久才突然出聲 */
const RESUME_WAIT_MS = 1000

interface AudioSessionNavigator {
  audioSession?: { type: string }
}

export function useSound(settings: Ref<Settings>) {
  let context: AudioContext | null = null

  function getContext(): AudioContext | null {
    if (context) return context
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    // 告訴 iPhone 這是一般提示音（ambient），不是在播音樂：手機切到靜音時就不會響
    const session = (navigator as AudioSessionNavigator).audioSession
    if (session) session.type = 'ambient'
    context = new Ctor()
    return context
  }

  function playNotes(ctx: AudioContext, notes: readonly Note[]): void {
    const volume = settings.value.volume * MAX_GAIN
    let at = ctx.currentTime + 0.01
    for (const [frequency, seconds] of notes) {
      if (frequency > 0) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.value = frequency
        gain.gain.setValueAtTime(volume, at)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
        osc.connect(gain).connect(ctx.destination)
        osc.start(at)
        osc.stop(at + seconds)
      }
      at += seconds
    }
  }

  // 在使用者點擊時呼叫：iOS 只允許在點擊時啟動聲音系統。只是解鎖，不會出聲
  async function unlock(): Promise<void> {
    const ctx = getContext()
    if (ctx && ctx.state !== 'running') await ctx.resume().catch(() => undefined)
  }

  function play(cue: SoundCue): void {
    if (cue === 'finish') navigator.vibrate?.([120, 80, 120, 80, 240])
    if (!settings.value.soundOn || settings.value.volume <= 0) return
    const ctx = context
    if (!ctx) return // 從來沒點過開始，聲音系統還沒解鎖，iOS 不准出聲
    if (ctx.state === 'running') {
      playNotes(ctx, CUES[cue])
      return
    }
    // 聲音系統暫停中：1 秒內恢復就響，恢復不了就算了（不會留著晚點補播）
    const timeout = new Promise<'late'>((resolve) =>
      setTimeout(() => resolve('late'), RESUME_WAIT_MS),
    )
    void Promise.race([ctx.resume().then(() => 'resumed' as const), timeout])
      .then((result) => {
        if (result === 'resumed' && ctx.state === 'running') playNotes(ctx, CUES[cue])
      })
      .catch(() => undefined)
  }

  // 第一次點畫面任何地方就解鎖聲音（只解鎖、不出聲）
  const onPointer = () => void unlock()
  document.addEventListener('pointerdown', onPointer, { capture: true })
  onScopeDispose(() => {
    document.removeEventListener('pointerdown', onPointer, { capture: true })
    void context?.close()
  })

  return { play, unlock }
}
