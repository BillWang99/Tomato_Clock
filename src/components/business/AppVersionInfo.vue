<script setup lang="ts">
import { computed } from 'vue'
import PixelButton from '@/components/base/PixelButton.vue'
import type { UpdateCheck } from '@/composables/useAppUpdate'

const props = defineProps<{
  version: string
  check: UpdateCheck
}>()

const emit = defineEmits<{ checkUpdate: []; update: [] }>()

const MESSAGES: Readonly<Record<UpdateCheck, string>> = Object.freeze({
  idle: '',
  checking: '檢查中…',
  latest: '已經是最新版本',
  available: '有新版本可以更新',
  unsupported: '這個瀏覽器不支援離線與自動更新',
})

const message = computed(() => MESSAGES[props.check])
</script>

<template>
  <div class="app-version-info">
    <p class="app-version-info__version">版本 {{ version }}</p>
    <div v-if="check !== 'unsupported'" class="app-version-info__actions">
      <PixelButton v-if="check === 'available'" variant="primary" @click="emit('update')">
        立即更新
      </PixelButton>
      <PixelButton v-else :disabled="check === 'checking'" @click="emit('checkUpdate')">
        檢查更新
      </PixelButton>
    </div>
    <p v-if="message" class="app-version-info__message" role="status">{{ message }}</p>
  </div>
</template>

<style scoped>
.app-version-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-half) var(--space-1);
}

.app-version-info__version,
.app-version-info__message {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.app-version-info__message {
  width: 100%;
}
</style>
