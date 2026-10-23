import { onScopeDispose, type Ref } from 'vue'
import type { Settings } from '@/core/settings'

export type SoundCue = 'start' | 'pause' | 'finish'

type Note = readonly [frequency: number, seconds: number]

// 8-bit 音效用方波即時合成，不放音檔，網頁小、離線也能響
const CUES: Readonly<Record<SoundCue, readonly Note[]>> = Object.freeze({
  start: [
    [783.99, 0.06],
    [1046.5, 0.09],
  ],
  pause: [
    [1046.5, 0.06],
    [783.99, 0.09],
  ],
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

export function useSound(settings: Ref<Settings>) {
  let context: AudioContext | null = null
  // iOS 在背景或重新整理後不准自己出聲，時間到的提示音先記著，使用者下一次點畫面時補播
  let pendingFinish = false

  function getContext(): AudioContext | null {
    if (context) return context
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
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

  function canPlay(): boolean {
    return settings.value.soundOn && settings.value.volume > 0
  }

  // 必須在使用者手勢中呼叫：iOS 只允許在點擊時啟動聲音
  async function unlock(): Promise<void> {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state !== 'running') await ctx.resume().catch(() => undefined)
    if (pendingFinish && ctx.state === 'running') {
      pendingFinish = false
      if (canPlay()) playNotes(ctx, CUES.finish)
    }
  }

  function play(cue: SoundCue): void {
    if (cue === 'finish') navigator.vibrate?.([120, 80, 120, 80, 240])
    if (!canPlay()) return
    const ctx = context
    if (ctx && ctx.state === 'running') {
      playNotes(ctx, CUES[cue])
      return
    }
    if (cue !== 'finish') return
    pendingFinish = true
    // 剛回到前景時有些瀏覽器允許直接恢復；不行就等下一次點擊
    void ctx
      ?.resume()
      .then(() => {
        if (ctx.state !== 'running' || !pendingFinish) return
        pendingFinish = false
        playNotes(ctx, CUES.finish)
      })
      .catch(() => undefined)
  }

  function dropPending(): void {
    pendingFinish = false
  }

  // 第一次點畫面任何地方就解鎖聲音
  const onPointer = () => void unlock()
  document.addEventListener('pointerdown', onPointer, { capture: true })
  onScopeDispose(() => {
    document.removeEventListener('pointerdown', onPointer, { capture: true })
    void context?.close()
  })

  return { play, unlock, dropPending }
}
