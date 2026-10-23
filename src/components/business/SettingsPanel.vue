<script setup lang="ts">
import PixelStepper from '@/components/base/PixelStepper.vue'
import PixelSwitch from '@/components/base/PixelSwitch.vue'
import { SETTING_RANGES, type Settings } from '@/core/settings'

defineProps<{
  settings: Settings
  wakeLockSupported: boolean
}>()

const emit = defineEmits<{ update: [patch: Partial<Settings>] }>()
</script>

<template>
  <div class="settings-panel">
    <fieldset class="settings-panel__group">
      <legend class="settings-panel__legend">時間</legend>
      <PixelStepper
        label="專注"
        unit="分"
        :range="SETTING_RANGES.focusMinutes"
        :model-value="settings.focusMinutes"
        @update:model-value="emit('update', { focusMinutes: $event })"
      />
      <PixelStepper
        label="短休息"
        unit="分"
        :range="SETTING_RANGES.shortBreakMinutes"
        :model-value="settings.shortBreakMinutes"
        @update:model-value="emit('update', { shortBreakMinutes: $event })"
      />
      <PixelStepper
        label="長休息"
        unit="分"
        :range="SETTING_RANGES.longBreakMinutes"
        :model-value="settings.longBreakMinutes"
        @update:model-value="emit('update', { longBreakMinutes: $event })"
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
    <p class="settings-panel__note">設定與紀錄只存在這台裝置的瀏覽器裡。</p>
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
