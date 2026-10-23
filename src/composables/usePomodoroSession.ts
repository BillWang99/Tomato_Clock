import { computed, ref } from 'vue'
import { documentTitle } from '@/core/format'
import type { Phase } from '@/core/timer'
import { ripenessStage, type TomatoMood } from '@/core/tomatoSprite'
import { useDocumentTitle } from './useDocumentTitle'
import { useNow } from './useNow'
import { useSettings } from './useSettings'
import { useSound } from './useSound'
import { useStats } from './useStats'
import { useTimer } from './useTimer'
import { useWakeLock } from './useWakeLock'

const MOODS: Readonly<Record<Phase, TomatoMood>> = Object.freeze({
  focus: 'awake',
  shortBreak: 'relaxed',
  longBreak: 'sleepy',
})

// 整個蕃茄鐘頁面的流程：計時、時間到的提示、統計、聲音、螢幕常亮。頁面只負責排版。
export function usePomodoroSession() {
  const clock = useNow()
  const { settings, updateSettings } = useSettings()
  const { todayStats, recordFocusMinutes } = useStats(clock.now)
  const sound = useSound(settings)

  /** 剛結束的階段；有值時顯示「時間到」橫幅，按「知道了」或任何操作後清掉 */
  const finishedPhase = ref<Phase | null>(null)
  /** 完成專注時 +1，觸發蕃茄跳一下與碎片 */
  const celebrateKey = ref(0)
  /** 任何階段結束時 +1，觸發畫面閃爍 */
  const flashKey = ref(0)

  const timer = useTimer(settings, clock, {
    onFinish(phase, minutes) {
      if (phase === 'focus') {
        recordFocusMinutes(minutes)
        celebrateKey.value += 1
      }
      finishedPhase.value = phase
      flashKey.value += 1
      sound.play('finish')
    },
  })

  const phase = computed(() => timer.state.value.phase)
  const status = computed(() => timer.state.value.status)
  const isRunning = computed(() => status.value === 'running')
  const mood = computed(() => MOODS[phase.value])
  // 專注時蕃茄隨進度變熟；休息時一律是熟透的紅蕃茄
  const stage = computed(() => (phase.value === 'focus' ? ripenessStage(timer.ratio.value) : 3))

  const { supported: wakeLockSupported } = useWakeLock(
    computed(() => settings.value.keepAwake && isRunning.value),
  )

  useDocumentTitle(
    computed(() =>
      documentTitle(phase.value, status.value, timer.remaining.value, finishedPhase.value !== null),
    ),
  )

  function dismissTimeUp(): void {
    finishedPhase.value = null
    sound.dropPending()
  }

  async function toggle(): Promise<void> {
    const wasRunning = isRunning.value
    dismissTimeUp()
    timer.toggle()
    await sound.unlock()
    sound.play(wasRunning ? 'pause' : 'start')
  }

  function reset(): void {
    dismissTimeUp()
    timer.reset()
  }

  function skip(): void {
    dismissTimeUp()
    timer.skipPhase()
  }

  function choosePhase(next: Phase): void {
    dismissTimeUp()
    timer.choosePhase(next)
  }

  return {
    settings,
    updateSettings,
    todayStats,
    phase,
    status,
    remaining: timer.remaining,
    ratio: timer.ratio,
    completedInCycle: computed(() => timer.state.value.completedInCycle),
    mood,
    stage,
    wakeLockSupported,
    finishedPhase,
    celebrateKey,
    flashKey,
    toggle,
    reset,
    skip,
    choosePhase,
    dismissTimeUp,
  }
}
