<script setup lang="ts">
import { PHASE_LABELS } from '@/core/format'
import { PHASES, type Phase } from '@/core/timer'

defineProps<{ phase: Phase }>()
const emit = defineEmits<{ select: [phase: Phase] }>()
</script>

<template>
  <div class="phase-tabs" role="tablist" aria-label="計時模式">
    <button
      v-for="item in PHASES"
      :key="item"
      type="button"
      role="tab"
      class="phase-tabs__tab"
      :class="`phase-tabs__tab--${item}`"
      :aria-selected="item === phase"
      @click="emit('select', item)"
    >
      {{ PHASE_LABELS[item] }}
    </button>
  </div>
</template>

<style scoped>
.phase-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--px);
  margin: var(--px);
  padding: var(--px);
  background: var(--color-edge);
}

.phase-tabs__tab {
  min-height: var(--touch-min);
  padding: var(--space-half) var(--space-1);
  border: none;
  border-radius: 0;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-md);
  cursor: pointer;
  touch-action: manipulation;
}

.phase-tabs__tab[aria-selected='true'] {
  background: var(--color-phase);
  color: var(--color-text-on-phase);
  box-shadow:
    inset var(--px) var(--px) 0 0 var(--color-phase-light),
    inset calc(var(--px) * -1) calc(var(--px) * -1) 0 0 var(--color-phase-dark);
}

@media (max-width: 359px) {
  .phase-tabs__tab {
    font-size: var(--font-sm);
  }
}
</style>
