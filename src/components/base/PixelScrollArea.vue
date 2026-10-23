<script setup lang="ts">
import { ref } from 'vue'
import { useScrollHints } from '@/composables/useScrollHints'
import PixelButton from './PixelButton.vue'

const viewport = ref<HTMLElement | null>(null)
const { scrollable, canScrollDown, showBackToTop, scrollToTop } = useScrollHints(viewport)
</script>

<template>
  <div class="pixel-scroll-area">
    <div ref="viewport" class="pixel-scroll-area__viewport">
      <div
        class="pixel-scroll-area__content"
        :class="{ 'pixel-scroll-area__content--scrollable': scrollable }"
      >
        <slot />
      </div>
    </div>
    <!-- 下面還有內容：底部漸層＋提示，讓人知道可以往下滑 -->
    <div v-if="canScrollDown" class="pixel-scroll-area__more" aria-hidden="true">
      <span class="pixel-scroll-area__more-label">▼ 往下還有</span>
    </div>
    <PixelButton v-if="showBackToTop" class="pixel-scroll-area__top" @click="scrollToTop">
      ▲ 回到最上方
    </PixelButton>
  </div>
</template>

<style scoped>
.pixel-scroll-area {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.pixel-scroll-area__viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

/* 需要捲動時底部留白：捲到最底，最後一列不會被「回到最上方」按鈕蓋住。
   不需要捲動時不留，免得本來放得下的內容被撐到要捲 */
.pixel-scroll-area__content--scrollable {
  padding-bottom: calc(var(--touch-min) + var(--space-2));
}

.pixel-scroll-area__more {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: var(--space-6);
  padding-bottom: var(--space-half);
  background: linear-gradient(transparent, var(--color-surface));
  pointer-events: none;
}

.pixel-scroll-area__more-label {
  padding: 0 var(--space-1);
  background: var(--color-surface-sunken);
  color: var(--color-phase-light);
  font-size: var(--font-sm);
  animation: nudge 1.4s steps(2) infinite;
}

.pixel-scroll-area__top {
  position: absolute;
  right: var(--space-half);
  bottom: var(--space-half);
  font-size: var(--font-sm);
}

@keyframes nudge {
  50% {
    transform: translateY(calc(var(--px) * -1));
  }
}

@media (prefers-reduced-motion: reduce) {
  .pixel-scroll-area__more-label {
    animation: none;
  }
}
</style>
