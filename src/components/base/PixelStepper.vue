<script setup lang="ts">
import { computed, useId } from 'vue'
import { clampToRange, type NumberRange } from '@/core/settings'
import PixelButton from './PixelButton.vue'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue: number
    range: NumberRange
    unit?: string
    /** 顯示用的倍數，例如音量 0～1 顯示成 0～10 */
    displayScale?: number
  }>(),
  { unit: '', displayScale: 1 },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const labelId = useId()

const display = computed(() => Math.round(props.modelValue * props.displayScale))
const atMin = computed(() => props.modelValue <= props.range.min)
const atMax = computed(() => props.modelValue >= props.range.max)

function change(direction: 1 | -1): void {
  emit(
    'update:modelValue',
    clampToRange(props.modelValue + direction * props.range.step, props.range),
  )
}
</script>

<template>
  <div class="pixel-stepper" role="group" :aria-labelledby="labelId">
    <span :id="labelId" class="pixel-stepper__label">{{ label }}</span>
    <div class="pixel-stepper__controls">
      <PixelButton :disabled="atMin" :aria-label="`${label}減少`" @click="change(-1)"
        >−</PixelButton
      >
      <output class="pixel-stepper__value" aria-live="polite">
        {{ display }}<small v-if="unit" class="pixel-stepper__unit">{{ unit }}</small>
      </output>
      <PixelButton :disabled="atMax" :aria-label="`${label}增加`" @click="change(1)">+</PixelButton>
    </div>
  </div>
</template>

<style scoped>
/* 欄位太窄時（摺疊機展開的右欄），加減按鈕自動換到下一行靠右 */
.pixel-stepper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-half) var(--space-1);
}

.pixel-stepper__label {
  font-size: var(--font-md);
  white-space: nowrap;
}

.pixel-stepper__controls {
  display: flex;
  margin-left: auto;
  align-items: center;
  gap: var(--space-half);
}

.pixel-stepper__value {
  min-width: calc(var(--font-md) * 3.5);
  font-size: var(--font-md);
  text-align: center;
}

.pixel-stepper__unit {
  margin-left: var(--space-half);
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}
</style>
