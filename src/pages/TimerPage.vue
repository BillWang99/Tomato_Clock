<script setup lang="ts">
import { ref } from 'vue'
import PixelDialog from '@/components/base/PixelDialog.vue'
import PixelPanel from '@/components/base/PixelPanel.vue'
import PixelScrollArea from '@/components/base/PixelScrollArea.vue'
import AppHeader from '@/components/business/AppHeader.vue'
import InstallGuideDialog from '@/components/business/InstallGuideDialog.vue'
import SettingsPanel from '@/components/business/SettingsPanel.vue'
import TimeKeypad from '@/components/business/TimeKeypad.vue'
import TimerPanel from '@/components/business/TimerPanel.vue'
import UpdateBanner from '@/components/business/UpdateBanner.vue'
import { useAppUpdate } from '@/composables/useAppUpdate'
import { useDurationEditor } from '@/composables/useDurationEditor'
import { useInstallPrompt } from '@/composables/useInstallPrompt'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { usePomodoroSession } from '@/composables/usePomodoroSession'
import { focusMinutesOf } from '@/core/stats'
import { PHASE_DURATION_KEYS } from '@/core/timer'

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
  pushStatus,
  pushError,
  pushAlertState,
  finishedPhase,
  celebrateKey,
  flashKey,
} = session

const editor = useDurationEditor(settings, session.updateSettings)
const installer = useInstallPrompt()
const updater = useAppUpdate()

const settingsOpen = ref(false)
// 只有寬又直的畫面（摺疊機展開、直放的平板）把設定放右欄，兩欄中間剛好避開摺痕；
// 橫式手機與電腦只留計時器，設定收進按鈕，畫面比較乾淨、不分心
const showSidePanel = useMediaQuery('(min-width: 600px) and (orientation: portrait)')
</script>

<template>
  <div
    class="timer-page"
    :data-phase="phase"
    :class="{ 'timer-page--scanlines': settings.scanlines }"
  >
    <AppHeader
      :completed="todayStats.completedPomodoros"
      :focus-minutes="focusMinutesOf(todayStats)"
      :show-settings-button="!showSidePanel"
      :show-install-button="installer.available.value"
      @open-settings="settingsOpen = true"
      @install="installer.install"
    />

    <main class="timer-page__main" :class="{ 'timer-page__main--split': showSidePanel }">
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
        :push-hint="pushStatus === 'on' ? pushAlertState : null"
        @select="session.choosePhase"
        @toggle="session.toggle"
        @reset="session.reset"
        @skip="session.skip"
        @dismiss="session.dismissTimeUp"
        @edit-time="editor.openEditor(PHASE_DURATION_KEYS[phase])"
      />

      <aside v-if="showSidePanel" class="timer-page__side">
        <PixelPanel title="設定">
          <PixelScrollArea>
            <SettingsPanel
              :settings="settings"
              :wake-lock-supported="wakeLockSupported"
              :push-status="pushStatus"
              :push-error="pushError"
              @toggle-push="session.togglePush"
              @update="session.updateSettings"
              @edit="editor.openEditor"
              @install-help="installer.install"
              :version="updater.version"
              :update-check="updater.check.value"
              @check-update="updater.checkNow"
              @apply-update="updater.applyUpdate"
            />
          </PixelScrollArea>
        </PixelPanel>
      </aside>
    </main>

    <PixelDialog
      v-if="!showSidePanel"
      :open="settingsOpen"
      title="設定"
      close-label="完成"
      @close="settingsOpen = false"
    >
      <SettingsPanel
        :settings="settings"
        :wake-lock-supported="wakeLockSupported"
        :push-status="pushStatus"
        :push-error="pushError"
        @toggle-push="session.togglePush"
        @update="session.updateSettings"
        @edit="editor.openEditor"
        @install-help="installer.install"
        :version="updater.version"
        :update-check="updater.check.value"
        @check-update="updater.checkNow"
        @apply-update="updater.applyUpdate"
      />
    </PixelDialog>

    <TimeKeypad
      v-if="editor.editingKey.value"
      open
      :title="editor.title.value"
      :seconds="editor.currentSeconds.value"
      @confirm="editor.confirmEditor"
      @close="editor.closeEditor"
    />

    <InstallGuideDialog
      v-if="installer.guidePlatform.value"
      :platform="installer.guidePlatform.value"
      @close="installer.closeGuide"
    />

    <UpdateBanner
      v-if="updater.needRefresh.value && !finishedPhase"
      @update="updater.applyUpdate"
      @dismiss="updater.dismiss"
    />

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

/* 摺疊機展開與直放平板：左右兩欄，兩欄中間留寬縫避開摺痕 */
.timer-page__main--split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: var(--hinge-gap);
  align-items: start;
}

.timer-page__main--split > .timer-page__timer,
.timer-page__side {
  justify-self: center;
  width: 100%;
  min-width: 0;
  max-width: var(--content-max);
}

.timer-page__side {
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

/* 手機橫放：整頁鎖在一個畫面高，主要按鈕不用捲就按得到 */
@media (min-width: 600px) and (max-height: 520px) {
  .timer-page {
    height: 100dvh;
  }

  .timer-page__main {
    min-height: 0;
    align-items: stretch;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timer-page__flash {
    animation: none;
  }
}
</style>
