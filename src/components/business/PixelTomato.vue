<script setup lang="ts">
import { computed } from 'vue'
import { buildTomatoSprite, SPRITE_SIZE, type TomatoMood } from '@/core/tomatoSprite'

const props = withDefaults(
  defineProps<{
    mood: TomatoMood
    /** 成熟度 0（青）～3（紅） */
    stage: 0 | 1 | 2 | 3
    /** 每次 +1 就跳一下（完成一顆蕃茄時） */
    hopKey?: number
    /** 小圖示用：不顯示睡覺的 z、不做動畫 */
    compact?: boolean
  }>(),
  { hopKey: 0, compact: false },
)

const pixels = computed(() => buildTomatoSprite(props.mood))
const showSleep = computed(() => props.mood === 'sleepy' && !props.compact)
</script>

<template>
  <div class="pixel-tomato" :class="{ 'pixel-tomato--compact': compact }" aria-hidden="true">
    <svg
      :key="hopKey"
      class="pixel-tomato__sprite"
      :class="{ 'pixel-tomato__sprite--hop': hopKey > 0 && !compact }"
      :data-stage="stage"
      :viewBox="`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`"
      shape-rendering="crispEdges"
    >
      <rect
        v-for="pixel in pixels"
        :key="`${pixel.x}-${pixel.y}`"
        :class="`tone-${pixel.tone}`"
        :x="pixel.x"
        :y="pixel.y"
        width="1"
        height="1"
      />
    </svg>
    <span v-if="showSleep" class="pixel-tomato__sleep">
      <span>z</span>
      <span>z</span>
    </span>
  </div>
</template>

<style scoped>
.pixel-tomato {
  position: relative;
  width: min(var(--tomato-size), 100%);
  aspect-ratio: 1;
}

.pixel-tomato--compact {
  width: var(--font-lg);
}

.pixel-tomato__sprite {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: 50% 100%;
}

.pixel-tomato__sprite--hop {
  animation: hop 640ms steps(8);
}

/* 成熟度決定身體三個顏色 */
[data-stage='0'] {
  --t-body: var(--color-tomato-0);
  --t-shade: var(--color-tomato-0-shade);
  --t-light: var(--color-tomato-0-light);
}
[data-stage='1'] {
  --t-body: var(--color-tomato-1);
  --t-shade: var(--color-tomato-1-shade);
  --t-light: var(--color-tomato-1-light);
}
[data-stage='2'] {
  --t-body: var(--color-tomato-2);
  --t-shade: var(--color-tomato-2-shade);
  --t-light: var(--color-tomato-2-light);
}
[data-stage='3'] {
  --t-body: var(--color-tomato-3);
  --t-shade: var(--color-tomato-3-shade);
  --t-light: var(--color-tomato-3-light);
}

.tone-outline,
.tone-eye {
  fill: var(--color-tomato-face);
}
.tone-body {
  fill: var(--t-body);
}
.tone-shade {
  fill: var(--t-shade);
}
.tone-highlight {
  fill: var(--t-light);
}
.tone-leaf {
  fill: var(--color-tomato-leaf);
}
.tone-leafDark {
  fill: var(--color-tomato-leaf-dark);
}
.tone-cheek {
  fill: var(--color-tomato-cheek);
}

.pixel-tomato__sleep {
  position: absolute;
  top: 0;
  right: calc(var(--space-1) * -1);
  display: flex;
  gap: var(--space-half);
  color: var(--color-phase-light);
  font-size: var(--font-lg);
}

.pixel-tomato__sleep span {
  animation: drift 2.4s steps(6) infinite;
}

.pixel-tomato__sleep span:last-child {
  font-size: var(--font-md);
  animation-delay: 1.2s;
}

@keyframes hop {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  20% {
    transform: translateY(0) scale(1.12, 0.88);
  }
  50% {
    transform: translateY(-18%) scale(0.94, 1.08);
  }
  80% {
    transform: translateY(0) scale(1.06, 0.94);
  }
}

@keyframes drift {
  0% {
    opacity: 0;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-120%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pixel-tomato__sleep span {
    animation: none;
  }
}
</style>
