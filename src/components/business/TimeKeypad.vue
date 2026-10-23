<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import PixelButton from '@/components/base/PixelButton.vue'
import PixelDialog from '@/components/base/PixelDialog.vue'
import {
  clearEntry,
  entryFromSeconds,
  entryToSeconds,
  isValidEntry,
  pressBackspace,
  pressDigit,
  selectSegment,
  stepSegment,
  type DurationEntry,
  type Segment,
} from '@/core/durationInput'
import { formatDuration, spokenDuration } from '@/core/format'
import DurationSegments from './DurationSegments.vue'

const props = defineProps<{
  open: boolean
  title: string
  /** 打開時顯示的目前時長（秒） */
  seconds: number
}>()

const emit = defineEmits<{
  confirm: [seconds: number]
  close: []
}>()

const DIGIT_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const PRESET_MINUTES = [5, 15, 25, 50] as const

// 頁面每次打開鍵盤都重新掛載這個元件，所以初始值就是目前時長
const entry = ref<DurationEntry>(entryFromSeconds(props.seconds))

const valid = computed(() => isValidEntry(entry.value))
const guide = computed(() => {
  if (!valid.value) return '時間不能是 00:00'
  return entry.value.segment === 'minutes'
    ? '正在輸入「分」：打完兩位數會自動跳到「秒」'
    : '正在輸入「秒」：點「分」可以改回分鐘'
})
// 確定按鈕上直接寫出總時間，少一行文字，小手機也放得下
const confirmLabel = computed(() =>
  valid.value ? `確定：${spokenDuration(entryToSeconds(entry.value))}` : '確定',
)

function digit(value: number): void {
  entry.value = pressDigit(entry.value, value)
}

function backspace(): void {
  entry.value = pressBackspace(entry.value)
}

function select(segment: Segment): void {
  entry.value = selectSegment(entry.value, segment)
}

function step(segment: Segment, delta: 1 | -1): void {
  entry.value = stepSegment(entry.value, segment, delta)
}

function usePreset(minutes: number): void {
  entry.value = entryFromSeconds(minutes * 60)
}

function confirm(): void {
  if (!valid.value) return
  emit('confirm', entryToSeconds(entry.value))
}

// 電腦上也能直接用鍵盤：數字輸入、Backspace 刪除、← → 或冒號切換分秒、↑ ↓ 加減、Enter 確定。
// 焦點在按鈕上時 Enter 交給按鈕自己（例如在「取消」上按 Enter 是取消）；
// 有按 Ctrl／Cmd／Alt 的是瀏覽器快捷鍵（Cmd+0 重設縮放），不攔。
function onKeydown(event: KeyboardEvent): void {
  if (!props.open || event.ctrlKey || event.metaKey || event.altKey) return
  const key = event.key
  if (/^[0-9]$/.test(key)) digit(Number(key))
  else if (key === 'Backspace') backspace()
  else if (key === ':' || key === 'ArrowRight') select('seconds')
  else if (key === 'ArrowLeft') select('minutes')
  else if (key === 'ArrowUp' || key === 'ArrowDown') {
    step(entry.value.segment, key === 'ArrowUp' ? 1 : -1)
  } else if (key === 'Enter' && !(event.target instanceof HTMLButtonElement)) confirm()
  else return
  event.preventDefault()
}

document.addEventListener('keydown', onKeydown)
onScopeDispose(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <PixelDialog :open="open" :title="title" close-label="取消" @close="emit('close')">
    <div class="time-keypad">
      <DurationSegments :entry="entry" @select="select" @step="step" />
      <p
        class="time-keypad__guide"
        :class="{ 'time-keypad__guide--error': !valid }"
        aria-live="polite"
      >
        {{ guide }}
      </p>

      <div class="time-keypad__presets" role="group" aria-label="常用時間">
        <PixelButton
          v-for="minutes in PRESET_MINUTES"
          :key="minutes"
          class="time-keypad__preset"
          @click="usePreset(minutes)"
        >
          {{ formatDuration(minutes * 60) }}
        </PixelButton>
      </div>

      <div class="time-keypad__grid">
        <PixelButton v-for="key in DIGIT_KEYS" :key="key" @click="digit(key)">
          {{ key }}
        </PixelButton>
        <PixelButton aria-label="清除" @click="entry = clearEntry()">清除</PixelButton>
        <PixelButton @click="digit(0)">0</PixelButton>
        <PixelButton aria-label="刪除一位" @click="backspace">⌫</PixelButton>
      </div>

      <PixelButton
        class="time-keypad__confirm"
        variant="primary"
        size="lg"
        :disabled="!valid"
        @click="confirm"
      >
        {{ confirmLabel }}
      </PixelButton>
    </div>
  </PixelDialog>
</template>

<style scoped>
.time-keypad {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-half);
}

.time-keypad__guide {
  font-size: var(--font-sm);
  color: var(--color-phase-light);
  text-align: center;
}

.time-keypad__guide--error {
  color: var(--c-orange);
}

.time-keypad__presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-half);
}

.time-keypad__preset {
  min-width: 0;
  padding: var(--space-half);
  font-size: var(--font-sm);
}

/* 數字鍵高度跟著畫面高度縮放：大手機好按，小手機也不用捲動就看得到「確定」 */
.time-keypad__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-half);
}

.time-keypad__grid > * {
  min-width: 0;
  min-height: clamp(var(--touch-min), 5.5dvh, calc(var(--touch-min) + var(--space-2)));
  padding: var(--space-half);
  font-size: var(--font-lg);
}

.time-keypad__confirm {
  min-width: 0;
}

/* 很矮的畫面（手機橫放）：數字鍵再縮小 */
@media (max-height: 520px) {
  .time-keypad__grid > * {
    min-height: var(--touch-min);
    font-size: var(--font-md);
  }
}
</style>
