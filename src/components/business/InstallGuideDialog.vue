<script setup lang="ts">
import { computed } from 'vue'
import PixelDialog from '@/components/base/PixelDialog.vue'
import type { GuidePlatform } from '@/composables/useInstallPrompt'

const props = defineProps<{ platform: GuidePlatform }>()
const emit = defineEmits<{ close: [] }>()

interface Step {
  text: string
  /** 這一步要不要畫「分享」圖示 */
  shareIcon?: boolean
}

const STEPS: Readonly<Record<GuidePlatform, readonly Step[]>> = Object.freeze({
  ios: [
    { text: '確認是用 Safari 打開。LINE、Facebook 裡的瀏覽器，請先點「用 Safari 開啟」。' },
    { text: '點畫面下方工具列的「分享」按鈕。', shareIcon: true },
    { text: '往下滑，點「加入主畫面」。' },
    { text: '按右上角「新增」，之後從主畫面的蕃茄圖示打開。' },
  ],
  android: [
    { text: '點瀏覽器右上角的選單（⋮）。' },
    { text: '點「安裝應用程式」或「加到主畫面」。' },
    { text: '按「安裝」，之後從主畫面的蕃茄圖示打開。' },
  ],
})

const steps = computed(() => STEPS[props.platform])
const title = computed(() => (props.platform === 'ios' ? '加入 iPhone 主畫面' : '安裝到 Android'))

// 「分享」圖示：方框加向上箭頭，用 7×8 點陣畫
const SHARE_PIXELS: readonly [number, number][] = [
  [3, 0],
  [2, 1],
  [3, 1],
  [4, 1],
  [3, 2],
  [3, 3],
  [3, 4],
  ...[0, 1, 5, 6].map((x) => [x, 3] as [number, number]),
  ...[0, 6].flatMap((x) => [4, 5, 6].map((y) => [x, y] as [number, number])),
  ...[0, 1, 2, 3, 4, 5, 6].map((x) => [x, 7] as [number, number]),
]
</script>

<template>
  <PixelDialog open :title="title" close-label="知道了" @close="emit('close')">
    <div class="install-guide">
      <p class="install-guide__benefit">
        裝好之後像一般 App 一樣從主畫面打開，可以離線使用，鎖螢幕也能收到時間到的提醒。
      </p>
      <ol class="install-guide__steps">
        <li v-for="(step, index) in steps" :key="step.text" class="install-guide__step">
          <span class="install-guide__number" aria-hidden="true">{{ index + 1 }}</span>
          <span class="install-guide__text">{{ step.text }}</span>
          <svg
            v-if="step.shareIcon"
            class="install-guide__icon"
            viewBox="0 0 7 8"
            shape-rendering="crispEdges"
            role="img"
            aria-label="分享圖示"
          >
            <rect
              v-for="[x, y] in SHARE_PIXELS"
              :key="`${x}-${y}`"
              :x="x"
              :y="y"
              width="1"
              height="1"
            />
          </svg>
        </li>
      </ol>
    </div>
  </PixelDialog>
</template>

<style scoped>
.install-guide {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.install-guide__benefit {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.install-guide__steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.install-guide__step {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.install-guide__number {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--space-4);
  height: var(--space-4);
  background: var(--color-phase);
  color: var(--color-text-on-phase);
  font-size: var(--font-md);
}

.install-guide__text {
  flex: 1;
  font-size: var(--font-md);
}

.install-guide__icon {
  flex: none;
  width: var(--space-4);
  fill: var(--c-sky);
}
</style>
