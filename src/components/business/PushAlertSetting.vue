<script setup lang="ts">
import PixelButton from '@/components/base/PixelButton.vue'
import PixelSwitch from '@/components/base/PixelSwitch.vue'
import type { PushStatus } from '@/composables/usePushAlerts'

defineProps<{
  status: PushStatus
  error: string
}>()

const emit = defineEmits<{ toggle: [on: boolean]; installHelp: [] }>()
</script>

<template>
  <div v-if="status !== 'hidden'" class="push-alert-setting">
    <PixelSwitch
      v-if="status === 'off' || status === 'on' || status === 'working'"
      label="鎖螢幕也提醒"
      hint="時間到時跳通知，手機鎖著也收得到（需要網路）"
      :model-value="status === 'on'"
      :disabled="status === 'working'"
      @update:model-value="emit('toggle', $event)"
    />
    <template v-else>
      <span class="push-alert-setting__label">鎖螢幕也提醒</span>
      <template v-if="status === 'needsInstall'">
        <p class="push-alert-setting__hint">
          iPhone 要先在 Safari 按分享 →「加入主畫面」，從主畫面打開才能使用。
        </p>
        <PixelButton class="push-alert-setting__help" @click="emit('installHelp')">
          怎麼加入主畫面
        </PixelButton>
      </template>
      <p v-else class="push-alert-setting__hint">
        通知被關閉了，請到手機的「設定 → 通知 → 蕃茄鐘」打開後再回來。
      </p>
    </template>
    <p v-if="error" class="push-alert-setting__error" role="status">{{ error }}</p>
  </div>
</template>

<style scoped>
.push-alert-setting {
  display: flex;
  flex-direction: column;
  gap: var(--space-half);
}

.push-alert-setting__label {
  font-size: var(--font-md);
}

.push-alert-setting__hint {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.push-alert-setting__help {
  align-self: flex-start;
  font-size: var(--font-sm);
}

.push-alert-setting__error {
  font-size: var(--font-sm);
  color: var(--c-orange);
}
</style>
