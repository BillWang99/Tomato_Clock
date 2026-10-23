<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  completed: number
  interval: number
}>()

// 本輪進度：亮幾格代表已完成幾個專注，滿了就接長休息
const filled = computed(() => Math.min(props.completed, props.interval))
const remainingText = computed(() => {
  const left = props.interval - filled.value
  return left <= 0 ? '這一輪完成，接長休息' : `再 ${left} 個專注就長休息`
})
</script>

<template>
  <div class="cycle-meter">
    <span class="cycle-meter__dots" aria-hidden="true">
      <span
        v-for="index in interval"
        :key="index"
        class="cycle-meter__dot"
        :class="{ 'cycle-meter__dot--on': index <= filled }"
      />
    </span>
    <span class="cycle-meter__text">{{ remainingText }}</span>
  </div>
</template>

<style scoped>
.cycle-meter {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.cycle-meter__dots {
  display: flex;
  gap: var(--space-half);
}

.cycle-meter__dot {
  width: var(--space-1);
  height: var(--space-1);
  background: var(--color-surface);
  box-shadow: 0 0 0 calc(var(--px) / 2) var(--color-edge);
}

.cycle-meter__dot--on {
  background: var(--c-red);
}
</style>
