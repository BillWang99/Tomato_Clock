<script setup lang="ts">
withDefaults(defineProps<{ title?: string; tag?: 'section' | 'div' }>(), {
  title: '',
  tag: 'section',
})
</script>

<template>
  <component :is="tag" class="pixel-panel">
    <h2 v-if="title" class="pixel-panel__title">{{ title }}</h2>
    <slot />
  </component>
</template>

<style scoped>
.pixel-panel {
  margin: var(--px);
  padding: var(--space-2);
  background: var(--color-surface);
  box-shadow:
    0 calc(var(--px) * -1) 0 0 var(--color-edge),
    0 var(--px) 0 0 var(--color-edge),
    calc(var(--px) * -1) 0 0 0 var(--color-edge),
    var(--px) 0 0 0 var(--color-edge),
    inset var(--px) var(--px) 0 0 var(--c-slate),
    inset calc(var(--px) * -1) calc(var(--px) * -1) 0 0 var(--c-ink);
}

.pixel-panel__title {
  margin-bottom: var(--space-1);
  font-size: var(--font-sm);
  font-weight: normal;
  color: var(--color-phase-light);
  letter-spacing: 0.1em;
}
</style>
