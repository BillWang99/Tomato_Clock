<script setup lang="ts">
import { computed } from 'vue'
import PixelDigits from '@/components/base/PixelDigits.vue'
import { formatClock } from '@/core/format'
import type { TimerStatus } from '@/core/timer'

const props = defineProps<{
  remainingMs: number
  progress: number
  status: TimerStatus
}>()

// 進度條切成 20 格，一格一格亮起來
const BLOCKS = 20

const clock = computed(() => formatClock(props.remainingMs))
const spokenTime = computed(() => {
  const [minutes, seconds] = clock.value.split(':').map(Number)
  return `剩下 ${minutes} 分 ${seconds} 秒`
})
const filledBlocks = computed(() => Math.floor(props.progress * BLOCKS))
const percent = computed(() => Math.round(props.progress * 100))
const statusText = computed(
  () => ({ idle: '準備開始', running: '計時中', paused: '已暫停' })[props.status],
)
</script>

<template>
  <div class="timer-display" :class="`timer-display--${status}`">
    <div class="timer-display__digits">
      <PixelDigits :text="clock" :label="spokenTime" />
    </div>
    <div
      class="timer-display__bar"
      role="progressbar"
      aria-label="本段進度"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span
        v-for="index in BLOCKS"
        :key="index"
        class="timer-display__block"
        :class="{ 'timer-display__block--on': index <= filledBlocks }"
      />
    </div>
    <p class="timer-display__status">{{ statusText }}</p>
  </div>
</template>

<style scoped>
.timer-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  width: min(var(--digits-width), 100%);
}

.timer-display__digits {
  width: 100%;
  color: var(--color-text);
}

.timer-display--paused .timer-display__digits {
  animation: blink 1.2s steps(1) infinite;
}

.timer-display__bar {
  display: grid;
  grid-template-columns: repeat(20, 1fr);
  gap: var(--px);
  width: 100%;
  padding: var(--px);
  background: var(--color-edge);
}

.timer-display__block {
  height: var(--space-2);
  background: var(--color-surface);
}

.timer-display__block--on {
  background: var(--color-phase-light);
}

.timer-display__status {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
  letter-spacing: 0.2em;
}

@keyframes blink {
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timer-display--paused .timer-display__digits {
    animation: none;
    opacity: 0.6;
  }
}
</style>
