<script setup lang="ts">
defineProps<{
  label: string
  modelValue: boolean
  /** 開關下方的小字說明 */
  hint?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    class="pixel-switch"
    :aria-checked="modelValue"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="pixel-switch__text">
      <span class="pixel-switch__label">{{ label }}</span>
      <span v-if="hint" class="pixel-switch__hint">{{ hint }}</span>
    </span>
    <span class="pixel-switch__track" aria-hidden="true">
      <span class="pixel-switch__knob" />
    </span>
  </button>
</template>

<style scoped>
.pixel-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--touch-min);
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
}

.pixel-switch__text {
  display: flex;
  flex-direction: column;
}

.pixel-switch__label {
  font-size: var(--font-md);
}

.pixel-switch__hint {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.pixel-switch__track {
  position: relative;
  flex: none;
  width: calc(var(--space-6) + var(--space-1));
  height: var(--space-3);
  margin: var(--px);
  background: var(--color-surface-sunken);
  box-shadow:
    0 calc(var(--px) * -1) 0 0 var(--color-edge),
    0 var(--px) 0 0 var(--color-edge),
    calc(var(--px) * -1) 0 0 0 var(--color-edge),
    var(--px) 0 0 0 var(--color-edge);
}

.pixel-switch__knob {
  position: absolute;
  top: var(--px);
  left: var(--px);
  width: var(--space-2);
  height: var(--space-2);
  background: var(--c-slate);
  transition: transform var(--duration-fast) steps(3);
}

.pixel-switch[aria-checked='true'] .pixel-switch__track {
  background: var(--color-phase-dark);
}

.pixel-switch[aria-checked='true'] .pixel-switch__knob {
  background: var(--color-phase-light);
  transform: translateX(calc(var(--space-6) + var(--space-1) - var(--space-2) - var(--px) * 2));
}
</style>
