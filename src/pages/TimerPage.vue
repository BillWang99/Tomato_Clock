<script setup lang="ts">
import { ref } from 'vue'
import PixelButton from '@/components/base/PixelButton.vue'
import PixelDialog from '@/components/base/PixelDialog.vue'
import PixelPanel from '@/components/base/PixelPanel.vue'
import SettingsPanel from '@/components/business/SettingsPanel.vue'
import TimerPanel from '@/components/business/TimerPanel.vue'
import TodayStats from '@/components/business/TodayStats.vue'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { usePomodoroSession } from '@/composables/usePomodoroSession'
import { APP_NAME } from '@/core/format'

const session = usePomodoroSession()
const {
  settings,
  todayStats,
  phase,
  status,
  remaining,
  ratio,
  completedInCycle,
  mood,
  stage,
  wakeLockSupported,
  finishedPhase,
  celebrateKey,
  flashKey,
} = session

const settingsOpen = ref(false)
// 寬螢幕（摺疊機展開、平板、電腦）設定直接放右欄；窄螢幕收進底部面板
const isWide = useMediaQuery('(min-width: 600px)')
</script>

<template>
  <div
    class="timer-page"
    :data-phase="phase"
    :class="{ 'timer-page--scanlines': settings.scanlines }"
  >
    <header class="timer-page__header">
      <h1 class="timer-page__title">{{ APP_NAME }}</h1>
      <TodayStats
        :completed="todayStats.completedPomodoros"
        :focus-minutes="todayStats.focusMinutes"
      />
      <PixelButton v-if="!isWide" aria-haspopup="dialog" @click="settingsOpen = true">
        設定
      </PixelButton>
    </header>

    <main class="timer-page__main">
      <TimerPanel
        class="timer-page__timer"
        :phase="phase"
        :status="status"
        :remaining-ms="remaining"
        :progress="ratio"
        :completed-in-cycle="completedInCycle"
        :long-break-interval="settings.longBreakInterval"
        :mood="mood"
        :stage="stage"
        :celebrate-key="celebrateKey"
        :finished-phase="finishedPhase"
        @select="session.choosePhase"
        @toggle="session.toggle"
        @reset="session.reset"
        @skip="session.skip"
        @dismiss="session.dismissTimeUp"
      />

      <aside v-if="isWide" class="timer-page__side">
        <PixelPanel title="設定">
          <SettingsPanel
            :settings="settings"
            :wake-lock-supported="wakeLockSupported"
            @update="session.updateSettings"
          />
        </PixelPanel>
      </aside>
    </main>

    <PixelDialog
      v-if="!isWide"
      :open="settingsOpen"
      title="設定"
      close-label="完成"
      @close="settingsOpen = false"
    >
      <SettingsPanel
        :settings="settings"
        :wake-lock-supported="wakeLockSupported"
        @update="session.updateSettings"
      />
    </PixelDialog>

    <div v-if="flashKey > 0" :key="flashKey" class="timer-page__flash" aria-hidden="true" />
  </div>
</template>

<style scoped>
.timer-page {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: max(var(--space-1), env(safe-area-inset-top))
    max(var(--space-2), env(safe-area-inset-right)) max(var(--space-2), env(safe-area-inset-bottom))
    max(var(--space-2), env(safe-area-inset-left));
  background-color: var(--color-phase-bg);
  /* 淡淡的像素格紋 */
  background-image:
    linear-gradient(var(--color-grid) var(--px), transparent var(--px)),
    linear-gradient(90deg, var(--color-grid) var(--px), transparent var(--px));
  background-size: var(--space-6) var(--space-6);
  transition: background-color var(--duration-base) steps(4);
}

.timer-page__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  max-width: var(--wide-max);
  margin: 0 auto;
}

.timer-page__title {
  margin-right: auto;
  font-size: var(--font-md);
  font-weight: normal;
  color: var(--color-phase-light);
}

.timer-page__main {
  flex: 1;
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: var(--wide-max);
  margin: 0 auto;
}

.timer-page__timer {
  flex: 1;
  max-width: var(--content-max);
}

.timer-page__side {
  flex: 1;
  max-width: var(--content-max);
  padding-top: var(--space-2);
}

/* 掃描線疊在最上層，不擋點擊 */
.timer-page--scanlines::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent calc(var(--px) / 2),
    var(--color-scanline) calc(var(--px) / 2),
    var(--color-scanline) var(--px)
  );
}

.timer-page__flash {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: var(--color-flash);
  opacity: 0;
  animation: flash 1.2s steps(1);
}

@keyframes flash {
  0%,
  33%,
  66% {
    opacity: 1;
  }
  16%,
  50%,
  83%,
  100% {
    opacity: 0;
  }
}

/* 摺疊機展開與平板：左右兩欄，兩欄中間留寬縫避開摺痕 */
@media (min-width: 600px) {
  .timer-page__main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: var(--hinge-gap);
    align-items: start;
  }

  .timer-page__timer,
  .timer-page__side {
    justify-self: center;
    width: 100%;
    min-width: 0;
  }
}

/* 手機橫放：整頁鎖在一個畫面高，設定欄自己捲動 */
@media (min-width: 600px) and (max-height: 520px) {
  .timer-page {
    height: 100dvh;
  }

  .timer-page__main {
    min-height: 0;
    align-items: stretch;
  }

  .timer-page__side {
    overflow-y: auto;
    padding-top: var(--space-1);
  }
}

/* 摺疊機外螢幕等很窄的畫面 */
@media (max-width: 359px) {
  .timer-page__title {
    display: none;
  }

  .timer-page__header {
    justify-content: space-between;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timer-page__flash {
    animation: none;
  }
}
</style>
