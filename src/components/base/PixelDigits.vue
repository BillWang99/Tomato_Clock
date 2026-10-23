<script setup lang="ts">
import { computed } from 'vue'
import { layoutPixelText } from '@/core/pixelFont'

const props = defineProps<{
  text: string
  /** 給螢幕閱讀器念的文字，例如「剩下 24 分 59 秒」 */
  label: string
}>()

// 每個點陣格放大兩倍，陰影只偏移半格，數字才不會糊成一團
const SCALE = 2
const layout = computed(() => layoutPixelText(props.text))
const viewBox = computed(
  () => `0 0 ${layout.value.width * SCALE + 1} ${layout.value.height * SCALE + 1}`,
)
</script>

<template>
  <svg
    class="pixel-digits"
    :viewBox="viewBox"
    role="img"
    :aria-label="label"
    shape-rendering="crispEdges"
  >
    <g class="pixel-digits__shadow">
      <rect
        v-for="cell in layout.cells"
        :key="`s-${cell.x}-${cell.y}`"
        :x="cell.x * SCALE + 1"
        :y="cell.y * SCALE + 1"
        :width="SCALE"
        :height="SCALE"
      />
    </g>
    <g class="pixel-digits__face">
      <rect
        v-for="cell in layout.cells"
        :key="`f-${cell.x}-${cell.y}`"
        :x="cell.x * SCALE"
        :y="cell.y * SCALE"
        :width="SCALE"
        :height="SCALE"
      />
    </g>
  </svg>
</template>

<style scoped>
.pixel-digits {
  display: block;
  width: 100%;
  height: auto;
}

.pixel-digits__face {
  fill: currentColor;
}

.pixel-digits__shadow {
  fill: var(--color-phase-dark);
}
</style>
