<script setup lang="ts">
import { computed, useId } from 'vue'
import { clampToRange, type NumberRange } from '@/core/settings'
import { formatDuration, spokenDuration } from '@/core/format'
import PixelButton from './PixelButton.vue'

const props = defineProps<{
  label: string
  /** 時長（秒） */
  seconds: number
  range: NumberRange
  /** −／+ 一次加減幾秒 */
  buttonStep: number
}>()

const emit = defineEmits<{
  update: [seconds: number]
  /** 點中間的時間：打開時間鍵盤 */
  edit: []
}>()

const labelId = useId()

const display = computed(() => formatDuration(props.seconds))
const atMin = computed(() => props.seconds <= props.range.min)
const atMax = computed(() => props.seconds >= props.range.max)

function change(direction: 1 | -1): void {
  emit('update', clampToRange(props.seconds + direction * props.buttonStep, props.range))
}
</script>

<template>
  <div class="pixel-duration-field" role="group" :aria-labelledby="labelId">
    <span :id="labelId" class="pixel-duration-field__label">{{ label }}</span>
    <div class="pixel-duration-field__controls">
      <PixelButton :disabled="atMin" :aria-label="`${label}減少一分鐘`" @click="change(-1)">
        −
      </PixelButton>
      <button
        type="button"
        class="pixel-duration-field__value"
        :aria-label="`${label} ${spokenDuration(seconds)}，點一下輸入時間`"
        @click="emit('edit')"
      >
        {{ display }}
      </button>
      <PixelButton :disabled="atMax" :aria-label="`${label}增加一分鐘`" @click="change(1)">
        +
      </PixelButton>
    </div>
  </div>
</template>

<style scoped>
/* 欄位太窄時（摺疊機展開的右欄），加減按鈕自動換到下一行靠右 */
.pixel-duration-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-half) var(--space-1);
}

.pixel-duration-field__label {
  font-size: var(--font-md);
  white-space: nowrap;
}

.pixel-duration-field__controls {
  display: flex;
  align-items: center;
  gap: var(--space-half);
  margin-left: auto;
}

/* 虛線底框 + 凹陷感，看起來像可以點的輸入格 */
.pixel-duration-field__value {
  min-width: calc(var(--font-md) * 4);
  min-height: var(--touch-min);
  padding: 0 var(--space-1);
  border: none;
  border-bottom: calc(var(--px) / 2) dashed var(--color-phase-light);
  background: var(--color-surface-sunken);
  color: var(--color-text);
  font-size: var(--font-md);
  cursor: pointer;
  touch-action: manipulation;
}

.pixel-duration-field__value:active {
  background: var(--color-phase-dark);
}
</style>
