<script setup lang="ts">
import PixelTomato from './PixelTomato.vue'

defineProps<{
  completed: number
  focusMinutes: number
}>()
</script>

<template>
  <p class="today-stats" :aria-label="`今天完成 ${completed} 顆蕃茄，專注 ${focusMinutes} 分鐘`">
    <PixelTomato mood="awake" :stage="3" compact />
    <span class="today-stats__count">× {{ completed }}</span>
    <span class="today-stats__minutes">{{ focusMinutes }} 分</span>
  </p>
</template>

<style scoped>
.today-stats {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-md);
}

.today-stats__minutes {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}
</style>
