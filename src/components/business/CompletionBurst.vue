<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { useReducedMotion } from '@/composables/useMediaQuery'

const props = defineProps<{
  /** 每次 +1 就爆一次 */
  burstKey: number
}>()

interface Particle {
  id: number
  dx: number
  dy: number
  tone: number
}

const PARTICLE_COUNT = 14
const LIFETIME_MS = 900

const reducedMotion = useReducedMotion()
const particles = ref<Particle[]>([])
let clearTimer = 0

// 碎片往四周飛，角度平均分配再加一點亂數，看起來自然但不會擠成一團
function explode(): void {
  if (reducedMotion.value) return
  particles.value = Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const angle = (index / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.4
    const distance = 70 + Math.random() * 50
    return {
      id: props.burstKey * 100 + index,
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance),
      tone: index % 3,
    }
  })
  window.clearTimeout(clearTimer)
  clearTimer = window.setTimeout(() => (particles.value = []), LIFETIME_MS)
}

watch(
  () => props.burstKey,
  (key) => key > 0 && explode(),
)
onScopeDispose(() => window.clearTimeout(clearTimer))
</script>

<template>
  <div class="completion-burst" aria-hidden="true">
    <span
      v-for="particle in particles"
      :key="particle.id"
      class="completion-burst__bit"
      :class="`completion-burst__bit--tone-${particle.tone}`"
      :style="{ '--dx': `${particle.dx}%`, '--dy': `${particle.dy}%` }"
    />
  </div>
</template>

<style scoped>
.completion-burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 位移用百分比（相對蕃茄大小），大小螢幕的爆炸範圍比例一致 */
.completion-burst__bit {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7%;
  aspect-ratio: 1;
  animation: fly var(--duration-burst) steps(9) forwards;
}

.completion-burst__bit--tone-0 {
  background: var(--c-red);
}
.completion-burst__bit--tone-1 {
  background: var(--c-yellow);
}
.completion-burst__bit--tone-2 {
  background: var(--c-lime);
}

@keyframes fly {
  0% {
    transform: translate(-50%, -50%);
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + var(--dx) * 14), calc(-50% + var(--dy) * 14));
    opacity: 0;
  }
}
</style>
