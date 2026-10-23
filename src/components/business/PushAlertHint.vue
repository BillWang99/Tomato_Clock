<script setup lang="ts">
import { computed } from 'vue'
import type { AlertState } from '@/composables/usePushAlerts'

const props = defineProps<{ state: AlertState }>()

// 告訴使用者什麼時候可以放心鎖螢幕：排好之前鎖，iPhone 可能把請求中斷
const TEXT: Readonly<Record<AlertState, string>> = Object.freeze({
  idle: '',
  sending: '正在排鎖屏提醒…',
  scheduled: '鎖屏提醒已排好，可以鎖螢幕了',
  failed: '鎖屏提醒沒排上，回到 App 會自動再試',
})

const text = computed(() => TEXT[props.state])
</script>

<template>
  <p
    v-if="text"
    class="push-alert-hint"
    :class="`push-alert-hint--${state}`"
    role="status"
    aria-live="polite"
  >
    <span class="push-alert-hint__icon" aria-hidden="true">{{
      state === 'failed' ? '!' : '♪'
    }}</span>
    {{ text }}
  </p>
</template>

<style scoped>
.push-alert-hint {
  display: flex;
  align-items: center;
  gap: var(--space-half);
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.push-alert-hint__icon {
  display: grid;
  place-items: center;
  width: var(--space-2);
  height: var(--space-2);
  background: var(--color-surface);
  color: var(--color-text);
}

.push-alert-hint--scheduled {
  color: var(--color-phase-light);
}

.push-alert-hint--failed {
  color: var(--c-orange);
}

.push-alert-hint--failed .push-alert-hint__icon {
  background: var(--c-orange);
  color: var(--c-ink);
}
</style>
