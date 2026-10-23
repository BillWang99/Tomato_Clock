import { computed, ref } from 'vue'
import { documentTitle } from '@/core/format'
import type { Phase } from '@/core/timer'
import { ripenessStage, type TomatoMood } from '@/core/tomatoSprite'
import { useDocumentTitle } from './useDocumentTitle'
import { useNow } from './useNow'
import { usePushAlerts } from './usePushAlerts'
import { useSettings } from './useSettings'
import { useSound } from './useSound'
import { useStats } from './useStats'
import { useTimer } from './useTimer'
import { useWakeLock } from './useWakeLock'

/** 晚了 2 秒以內發現時間到，算是 App 開著準時看到的 */
const ON_TIME_MS = 2000

const MOODS: Readonly<Record<Phase, TomatoMood>> = Object.freeze({
  focus: 'awake',
  shortBreak: 'relaxed',
  longBreak: 'sleepy',
})

// 整個蕃茄鐘頁面的流程：計時、時間到的提示、統計、聲音、螢幕常亮。頁面只負責排版。
export function usePomodoroSession() {
  const clock = useNow()
  const { settings, updateSettings } = useSettings()
  const { todayStats, recordFocusSeconds } = useStats(clock.now)
  const sound = useSound(settings)

  /** 剛結束的階段；有值時顯示「時間到」橫幅，按「知道了」或任何操作後清掉 */
  const finishedPhase = ref<Phase | null>(null)
  /** 完成專注時 +1，觸發蕃茄跳一下與碎片 */
  const celebrateKey = ref(0)
  /** 任何階段結束時 +1，觸發畫面閃爍 */
  const flashKey = ref(0)

  const timer = useTimer(settings, clock, {
    onFinish(phase, seconds, lateMs) {
      if (phase === 'focus') {
        recordFocusSeconds(seconds)
        celebrateKey.value += 1
      }
      finishedPhase.value = phase
      flashKey.value += 1
      // 只在「準時」的那一刻響：App 開著、剛好到時間。從背景回來才發現的（鎖屏時推播通知已經響過）
      // 只顯示橫幅不出聲，不會在使用者沒預期的時候突然冒出聲音
      if (lateMs <= ON_TIME_MS) sound.play('finish')
    },
  })

  const phase = computed(() => timer.state.value.phase)
  const status = computed(() => timer.state.value.status)
  const isRunning = computed(() => status.value === 'running')
  // 計時中切到背景（鎖螢幕、切 App）時，數字先換成 --:--：iPhone 解鎖時會先秀出凍結前的那一格畫面，
  // 程式恢復前那一瞬間就不會看到停住的舊秒數。暫停中、還沒開始的數字本來就是對的，不用換
  const clockMasked = computed(() => isRunning.value && !clock.visible.value)
  const mood = computed(() => MOODS[phase.value])
  // 專注時蕃茄隨進度變熟；休息時一律是熟透的紅蕃茄
  const stage = computed(() => (phase.value === 'focus' ? ripenessStage(timer.ratio.value) : 3))

  const push = usePushAlerts(settings, updateSettings, timer.state)

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
  }

  async function toggle(): Promise<void> {
    const wasRunning = isRunning.value
    dismissTimeUp()
    // 要開始計時：趁還在點擊裡先準備好推播訂閱，排程請求才能在使用者鎖螢幕前送出
    if (!wasRunning) void push.prepare()
    timer.toggle()
    // 計時中不出聲讓使用者專注；這裡只是趁點擊解鎖聲音，時間到時才響得出來
    await sound.unlock()
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
    clockMasked,
    ratio: timer.ratio,
    completedInCycle: computed(() => timer.state.value.completedInCycle),
    mood,
    stage,
    wakeLockSupported,
    pushStatus: push.status,
    pushError: push.errorMessage,
    pushAlertState: push.alertState,
    togglePush: push.toggle,
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
