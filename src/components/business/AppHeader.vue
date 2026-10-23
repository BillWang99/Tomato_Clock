<script setup lang="ts">
import PixelButton from '@/components/base/PixelButton.vue'
import { APP_NAME } from '@/core/format'
import TodayStats from './TodayStats.vue'

defineProps<{
  completed: number
  focusMinutes: number
  /** 設定欄沒有直接顯示時（手機、橫式、電腦），才需要「設定」按鈕 */
  showSettingsButton: boolean
  /** 還沒安裝、而且這個瀏覽器能安裝時才顯示「安裝」 */
  showInstallButton: boolean
}>()

const emit = defineEmits<{ openSettings: []; install: [] }>()
</script>

<template>
  <header
    class="app-header"
    :class="{ 'app-header--crowded': showSettingsButton && showInstallButton }"
  >
    <h1 class="app-header__title">{{ APP_NAME }}</h1>
    <TodayStats :completed="completed" :focus-minutes="focusMinutes" />
    <div class="app-header__actions">
      <PixelButton v-if="showInstallButton" aria-haspopup="dialog" @click="emit('install')">
        安裝
      </PixelButton>
      <PixelButton v-if="showSettingsButton" aria-haspopup="dialog" @click="emit('openSettings')">
        設定
      </PixelButton>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  max-width: var(--wide-max);
  margin: 0 auto;
}

.app-header__title {
  margin-right: auto;
  font-size: var(--font-md);
  font-weight: normal;
  color: var(--color-phase-light);
  white-space: nowrap;
}

.app-header__actions {
  display: flex;
  gap: var(--space-half);
}

/* 摺疊機外螢幕等很窄的畫面：不顯示標題 */
@media (max-width: 359px) {
  .app-header__title {
    display: none;
  }

  .app-header {
    justify-content: space-between;
  }
}

/* 「安裝」「設定」兩個按鈕都在時，一般手機也放不下標題 */
@media (max-width: 439px) {
  .app-header--crowded .app-header__title {
    display: none;
  }

  .app-header--crowded {
    justify-content: space-between;
  }
}
</style>
