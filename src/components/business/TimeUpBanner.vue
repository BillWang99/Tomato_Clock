<script setup lang="ts">
import PixelButton from '@/components/base/PixelButton.vue'
import { FINISH_MESSAGES } from '@/core/format'
import type { Phase } from '@/core/timer'

defineProps<{ finishedPhase: Phase }>()
const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="time-up-banner" role="alert">
    <p class="time-up-banner__text">{{ FINISH_MESSAGES[finishedPhase] }}</p>
    <PixelButton @click="emit('dismiss')">知道了</PixelButton>
  </div>
</template>

<style scoped>
/* 固定在畫面上方，出現時不推動下面的版面 */
.time-up-banner {
  position: fixed;
  top: calc(env(safe-area-inset-top) + var(--space-2));
  right: var(--space-2);
  left: var(--space-2);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1);
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-1) var(--space-2);
  background: var(--c-yellow);
  color: var(--c-ink);
  box-shadow:
    0 calc(var(--px) * -1) 0 0 var(--color-edge),
    0 var(--px) 0 0 var(--color-edge),
    calc(var(--px) * -1) 0 0 0 var(--color-edge),
    var(--px) 0 0 0 var(--color-edge);
  animation: drop-in var(--duration-base) steps(4);
}

.time-up-banner__text {
  font-size: var(--font-md);
}

@keyframes drop-in {
  from {
    transform: translateY(-50%);
    opacity: 0;
  }
}
</style>
