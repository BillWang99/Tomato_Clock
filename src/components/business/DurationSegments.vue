<script setup lang="ts">
import PixelDigits from '@/components/base/PixelDigits.vue'
import { pad2, type DurationEntry, type Segment } from '@/core/durationInput'

defineProps<{ entry: DurationEntry }>()

const emit = defineEmits<{
  select: [segment: Segment]
  step: [segment: Segment, delta: 1 | -1]
}>()

const SEGMENTS: readonly { key: Segment; label: string }[] = [
  { key: 'minutes', label: '分' },
  { key: 'seconds', label: '秒' },
]
</script>

<template>
  <div class="duration-segments">
    <template v-for="(segment, index) in SEGMENTS" :key="segment.key">
      <span v-if="index > 0" class="duration-segments__colon" aria-hidden="true">:</span>
      <div
        class="duration-segments__column"
        :class="{ 'duration-segments__column--active': entry.segment === segment.key }"
      >
        <button
          type="button"
          class="duration-segments__step"
          :aria-label="`${segment.label}加一`"
          @click="emit('step', segment.key, 1)"
        >
          ▲
        </button>
        <button
          type="button"
          class="duration-segments__value"
          :aria-pressed="entry.segment === segment.key"
          :aria-label="`${entry[segment.key]} ${segment.label}，點一下輸入${segment.label}`"
          @click="emit('select', segment.key)"
        >
          <PixelDigits
            :text="pad2(entry[segment.key])"
            :label="`${entry[segment.key]} ${segment.label}`"
          />
        </button>
        <span class="duration-segments__label">{{ segment.label }}</span>
        <button
          type="button"
          class="duration-segments__step"
          :aria-label="`${segment.label}減一`"
          @click="emit('step', segment.key, -1)"
        >
          ▼
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.duration-segments {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
}

.duration-segments__column {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-half);
  width: min(calc(var(--digits-width) * 0.3), 34%);
}

.duration-segments__colon {
  font-size: var(--font-xl);
  color: var(--color-text-muted);
}

.duration-segments__step {
  min-height: var(--touch-min);
  border: none;
  background: var(--color-surface-sunken);
  color: var(--color-text-muted);
  font-size: var(--font-md);
  cursor: pointer;
  touch-action: manipulation;
}

.duration-segments__step:active {
  background: var(--color-phase-dark);
  color: var(--color-text);
}

/* 正在輸入的那一格：亮框＋數字變白；另一格暗下來 */
.duration-segments__value {
  padding: var(--space-1);
  border: none;
  background: var(--color-surface-sunken);
  color: var(--color-text-muted);
  cursor: pointer;
  touch-action: manipulation;
  box-shadow: inset 0 0 0 var(--px) var(--color-surface);
}

.duration-segments__column--active .duration-segments__value {
  color: var(--color-text);
  box-shadow: inset 0 0 0 var(--px) var(--color-phase-light);
  animation: cursor-glow 1.2s steps(2) infinite;
}

.duration-segments__label {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
  text-align: center;
}

.duration-segments__column--active .duration-segments__label {
  color: var(--color-phase-light);
}

@keyframes cursor-glow {
  50% {
    box-shadow: inset 0 0 0 var(--px) var(--color-phase);
  }
}

@media (prefers-reduced-motion: reduce) {
  .duration-segments__column--active .duration-segments__value {
    animation: none;
  }
}
</style>
