<script setup lang="ts">
import type { Phase, TimerStatus } from '@/core/timer'
import type { TomatoMood } from '@/core/tomatoSprite'
import CompletionBurst from './CompletionBurst.vue'
import ControlBar from './ControlBar.vue'
import CycleMeter from './CycleMeter.vue'
import PhaseTabs from './PhaseTabs.vue'
import PixelTomato from './PixelTomato.vue'
import TimerDisplay from './TimerDisplay.vue'
import TimeUpBanner from './TimeUpBanner.vue'

defineProps<{
  phase: Phase
  status: TimerStatus
  remainingMs: number
  progress: number
  completedInCycle: number
  longBreakInterval: number
  mood: TomatoMood
  stage: 0 | 1 | 2 | 3
  celebrateKey: number
  finishedPhase: Phase | null
}>()

const emit = defineEmits<{
  select: [phase: Phase]
  toggle: []
  reset: []
  skip: []
  dismiss: []
  editTime: []
}>()
</script>

<template>
  <section class="timer-panel" aria-label="計時器">
    <PhaseTabs class="timer-panel__tabs" :phase="phase" @select="emit('select', $event)" />

    <div class="timer-panel__center">
      <div class="timer-panel__stage">
        <PixelTomato :mood="mood" :stage="stage" :hop-key="celebrateKey" />
        <CompletionBurst :burst-key="celebrateKey" />
      </div>
      <TimerDisplay
        class="timer-panel__display"
        :remaining-ms="remainingMs"
        :progress="progress"
        :status="status"
        @edit="emit('editTime')"
      />
      <CycleMeter
        class="timer-panel__cycle"
        :completed="completedInCycle"
        :interval="longBreakInterval"
      />
    </div>

    <TimeUpBanner v-if="finishedPhase" :finished-phase="finishedPhase" @dismiss="emit('dismiss')" />

    <ControlBar
      class="timer-panel__controls"
      :status="status"
      @toggle="emit('toggle')"
      @reset="emit('reset')"
      @skip="emit('skip')"
    />
  </section>
</template>

<style scoped>
/* 主要按鈕推到下方，大手機單手也按得到 */
.timer-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-top: var(--space-2);
}

.timer-panel__tabs {
  align-self: stretch;
}

.timer-panel__center {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.timer-panel__stage {
  position: relative;
  display: grid;
  place-items: center;
}

.timer-panel__controls {
  padding-bottom: var(--space-1);
}

/* 兩欄（摺疊機展開）時跟右邊的設定欄一起靠上 */
@media (min-width: 600px) and (orientation: portrait) {
  .timer-panel {
    justify-content: flex-start;
  }
}

/* 電腦與平板橫放：只有計時器一欄，整組置中、不要被拉開 */
@media (min-width: 600px) and (orientation: landscape) and (min-height: 521px) {
  .timer-panel {
    justify-content: center;
    gap: var(--space-3);
  }
}

/* 手機橫放（寬但很矮）：蕃茄放在數字左邊，主要按鈕不用捲就按得到 */
@media (min-width: 600px) and (max-height: 520px) {
  /* 頁首有「設定」按鈕，這裡把上下間距縮到最小，整組才塞得進手機橫放的高度 */
  .timer-panel {
    justify-content: space-between;
    gap: var(--space-half);
    padding-top: 0;
  }

  .timer-panel__controls {
    padding-bottom: 0;
  }

  .timer-panel__center {
    display: grid;
    grid-template-columns: var(--tomato-size) minmax(0, 1fr);
    grid-template-areas:
      'stage display'
      'stage cycle';
    align-items: center;
    column-gap: var(--space-2);
    row-gap: var(--space-1);
  }

  .timer-panel__stage {
    grid-area: stage;
    width: var(--tomato-size);
  }

  .timer-panel__display {
    grid-area: display;
  }

  .timer-panel__cycle {
    grid-area: cycle;
  }
}
</style>
