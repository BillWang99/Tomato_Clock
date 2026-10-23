<script setup lang="ts">
import PixelDurationField from '@/components/base/PixelDurationField.vue'
import PixelStepper from '@/components/base/PixelStepper.vue'
import PixelSwitch from '@/components/base/PixelSwitch.vue'
import AppVersionInfo from './AppVersionInfo.vue'
import PushAlertSetting from './PushAlertSetting.vue'
import type { PushStatus } from '@/composables/usePushAlerts'
import type { UpdateCheck } from '@/composables/useAppUpdate'
import { DURATION_LABELS } from '@/core/format'
import {
  DURATION_BUTTON_STEP,
  DURATION_KEYS,
  SETTING_RANGES,
  type DurationKey,
  type Settings,
} from '@/core/settings'

defineProps<{
  settings: Settings
  wakeLockSupported: boolean
  pushStatus: PushStatus
  pushError: string
  version: string
  updateCheck: UpdateCheck
}>()

const emit = defineEmits<{
  update: [patch: Partial<Settings>]
  /** 點了某個時長：打開時間鍵盤 */
  edit: [key: DurationKey]
  /** 鎖螢幕也提醒：打開時要問通知權限，所以交給上層處理 */
  togglePush: [on: boolean]
  /** 想知道怎麼加入主畫面 */
  installHelp: []
  checkUpdate: []
  applyUpdate: []
}>()
</script>

<template>
  <div class="settings-panel">
    <fieldset class="settings-panel__group">
      <legend class="settings-panel__legend">時間</legend>
      <PixelDurationField
        v-for="key in DURATION_KEYS"
        :key="key"
        :label="DURATION_LABELS[key]"
        :seconds="settings[key]"
        :range="SETTING_RANGES[key]"
        :button-step="DURATION_BUTTON_STEP"
        @update="emit('update', { [key]: $event })"
        @edit="emit('edit', key)"
      />
      <PixelStepper
        label="幾個專注後長休息"
        unit="個"
        :range="SETTING_RANGES.longBreakInterval"
        :model-value="settings.longBreakInterval"
        @update:model-value="emit('update', { longBreakInterval: $event })"
      />
      <PixelSwitch
        label="時間到自動開始下一段"
        :model-value="settings.autoStartNext"
        @update:model-value="emit('update', { autoStartNext: $event })"
      />
    </fieldset>

    <fieldset class="settings-panel__group">
      <legend class="settings-panel__legend">聲音與畫面</legend>
      <PixelSwitch
        label="提示音"
        hint="手機靜音時不會響"
        :model-value="settings.soundOn"
        @update:model-value="emit('update', { soundOn: $event })"
      />
      <PixelStepper
        v-if="settings.soundOn"
        label="音量"
        :range="SETTING_RANGES.volume"
        :display-scale="10"
        :model-value="settings.volume"
        @update:model-value="emit('update', { volume: $event })"
      />
      <PushAlertSetting
        :status="pushStatus"
        :error="pushError"
        @toggle="emit('togglePush', $event)"
        @install-help="emit('installHelp')"
      />
      <PixelSwitch
        v-if="wakeLockSupported"
        label="計時中螢幕常亮"
        hint="螢幕不自動鎖定，時間到才聽得到提示音"
        :model-value="settings.keepAwake"
        @update:model-value="emit('update', { keepAwake: $event })"
      />
      <PixelSwitch
        label="復古掃描線"
        :model-value="settings.scanlines"
        @update:model-value="emit('update', { scanlines: $event })"
      />
    </fieldset>
    <p class="settings-panel__note">設定會自動保存在這台裝置的瀏覽器裡，下次打開不用重設。</p>
    <AppVersionInfo
      :version="version"
      :check="updateCheck"
      @check-update="emit('checkUpdate')"
      @update="emit('applyUpdate')"
    />
  </div>
</template>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.settings-panel__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  border: none;
}

.settings-panel__legend {
  margin-bottom: var(--space-1);
  padding: 0;
  font-size: var(--font-sm);
  color: var(--color-phase-light);
  letter-spacing: 0.1em;
}

.settings-panel__note {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}
</style>
