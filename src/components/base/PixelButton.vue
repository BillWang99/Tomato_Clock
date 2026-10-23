<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary'
    size?: 'md' | 'lg'
  }>(),
  { variant: 'secondary', size: 'md' },
)
</script>

<template>
  <button
    type="button"
    class="pixel-button"
    :class="[`pixel-button--${variant}`, `pixel-button--${size}`]"
  >
    <slot />
  </button>
</template>

<style scoped>
/* 缺角外框 + 底部厚度 + 內側光影，全部用 box-shadow 畫，按下時往下沉一格 */
.pixel-button {
  --btn-bg: var(--color-surface);
  --btn-fg: var(--color-text);
  --btn-light: var(--c-slate);
  --btn-shade: var(--c-ink);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  margin: var(--px) var(--px) calc(var(--px) * 3);
  padding: var(--space-1) var(--space-2);
  border: none;
  border-radius: 0;
  background: var(--btn-bg);
  color: var(--btn-fg);
  font-size: var(--font-md);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  box-shadow:
    0 calc(var(--px) * -1) 0 0 var(--color-edge),
    0 var(--px) 0 0 var(--color-edge),
    calc(var(--px) * -1) 0 0 0 var(--color-edge),
    var(--px) 0 0 0 var(--color-edge),
    0 calc(var(--px) * 2) 0 0 var(--color-edge),
    inset var(--px) var(--px) 0 0 var(--btn-light),
    inset calc(var(--px) * -1) calc(var(--px) * -1) 0 0 var(--btn-shade);
  transition: transform var(--duration-fast) steps(2);
}

.pixel-button--primary {
  --btn-bg: var(--color-phase);
  --btn-fg: var(--color-text-on-phase);
  --btn-light: var(--color-phase-light);
  --btn-shade: var(--color-phase-dark);
}

.pixel-button--lg {
  min-width: min(calc(var(--touch-min) * 3.5), 40vw);
  min-height: calc(var(--touch-min) + var(--space-2));
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-lg);
}

.pixel-button:active:not(:disabled) {
  transform: translateY(var(--px));
  box-shadow:
    0 calc(var(--px) * -1) 0 0 var(--color-edge),
    0 var(--px) 0 0 var(--color-edge),
    calc(var(--px) * -1) 0 0 0 var(--color-edge),
    var(--px) 0 0 0 var(--color-edge),
    inset var(--px) var(--px) 0 0 var(--btn-shade),
    inset calc(var(--px) * -1) calc(var(--px) * -1) 0 0 var(--btn-light);
}

.pixel-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (hover: hover) {
  .pixel-button:hover:not(:disabled) {
    filter: brightness(1.12);
  }
}
</style>
