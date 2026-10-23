<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import PixelButton from '@/components/base/PixelButton.vue'
import PixelDialog from '@/components/base/PixelDialog.vue'
import PixelDigits from '@/components/base/PixelDigits.vue'
import {
  clearEntry,
  entryDisplay,
  entryFromSeconds,
  entryToSeconds,
  isValidEntry,
  pressBackspace,
  pressDigit,
  type KeypadEntry,
} from '@/core/durationInput'
import { formatDuration, spokenDuration } from '@/core/format'

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

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
const PRESET_MINUTES = [5, 15, 25, 50] as const

const entry = ref<KeypadEntry>(entryFromSeconds(props.seconds))

const display = computed(() => entryDisplay(entry.value))
const valid = computed(() => isValidEntry(entry.value))
const hint = computed(() => {
  const seconds = entryToSeconds(entry.value)
  if (seconds === 0) return '輸入分鐘與秒數，例如 5030 = 50 分 30 秒'
  if (!valid.value) return '最長 99:59'
  return `共 ${spokenDuration(seconds)}`
})

function digit(value: string): void {
  entry.value = pressDigit(entry.value, value)
}

function backspace(): void {
  entry.value = pressBackspace(entry.value)
}

function usePreset(minutes: number): void {
  entry.value = entryFromSeconds(minutes * 60)
}

function confirm(): void {
  if (!valid.value) return
  emit('confirm', entryToSeconds(entry.value))
}

// 電腦上也能直接用鍵盤打數字、Backspace 刪除、Enter 確定。
// 焦點在按鈕上時 Enter 交給按鈕自己（例如在「取消」上按 Enter 是取消）；
// 有按 Ctrl／Cmd／Alt 的是瀏覽器快捷鍵（Cmd+0 重設縮放），不攔。
function onKeydown(event: KeyboardEvent): void {
  if (!props.open || event.ctrlKey || event.metaKey || event.altKey) return
  if (/^[0-9]$/.test(event.key)) digit(event.key)
  else if (event.key === 'Backspace') backspace()
  else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) confirm()
  else return
  event.preventDefault()
}

// 頁面每次打開鍵盤都重新掛載這個元件，所以 entry 的初始值就是目前時長，不用另外監看 open
document.addEventListener('keydown', onKeydown)
onScopeDispose(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <PixelDialog :open="open" :title="title" close-label="取消" @close="emit('close')">
    <div class="time-keypad">
      <div class="time-keypad__screen" :class="{ 'time-keypad__screen--fresh': entry.fresh }">
        <PixelDigits :text="display" :label="`目前輸入 ${display}`" />
      </div>
      <p class="time-keypad__hint" aria-live="polite">{{ hint }}</p>

      <div class="time-keypad__presets">
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
        <PixelButton v-for="key in DIGIT_KEYS" :key="key" size="lg" @click="digit(key)">
          {{ key }}
        </PixelButton>
        <PixelButton size="lg" aria-label="清除" @click="entry = clearEntry()">清除</PixelButton>
        <PixelButton size="lg" @click="digit('0')">0</PixelButton>
        <PixelButton size="lg" aria-label="刪除一位" @click="backspace">⌫</PixelButton>
      </div>

      <PixelButton
        class="time-keypad__confirm"
        variant="primary"
        size="lg"
        :disabled="!valid"
        @click="confirm"
      >
        確定
      </PixelButton>
    </div>
  </PixelDialog>
</template>

<style scoped>
.time-keypad {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-1);
}

.time-keypad__screen {
  align-self: center;
  width: min(var(--digits-width), 100%);
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface-sunken);
  color: var(--color-text);
}

/* 還沒開始輸入時數字暗一點，表示按任何數字會整個重來 */
.time-keypad__screen--fresh {
  color: var(--color-text-muted);
}

.time-keypad__hint {
  min-height: calc(var(--font-sm) * var(--line-height));
  font-size: var(--font-sm);
  color: var(--color-text-muted);
  text-align: center;
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

.time-keypad__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-half);
}

.time-keypad__grid > * {
  min-width: 0;
  padding: var(--space-1);
}

.time-keypad__confirm {
  min-width: 0;
}

/* 很矮的畫面（手機橫放）：數字鍵縮小，整個鍵盤不用捲動 */
@media (max-height: 520px) {
  .time-keypad__grid > * {
    min-height: var(--touch-min);
    font-size: var(--font-md);
  }
}
</style>
