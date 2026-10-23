<script setup lang="ts">
import { computed } from 'vue'
import PixelButton from '@/components/base/PixelButton.vue'
import type { TimerStatus } from '@/core/timer'

const props = defineProps<{ status: TimerStatus }>()
const emit = defineEmits<{ toggle: []; reset: []; skip: [] }>()

const mainLabel = computed(() => ({ idle: '開始', running: '暫停', paused: '繼續' })[props.status])
</script>

<template>
  <div class="control-bar">
    <PixelButton
      class="control-bar__side"
      :disabled="status === 'idle'"
      aria-label="重設本段"
      @click="emit('reset')"
    >
      重設
    </PixelButton>
    <PixelButton variant="primary" size="lg" @click="emit('toggle')">{{ mainLabel }}</PixelButton>
    <PixelButton class="control-bar__side" aria-label="跳過本段" @click="emit('skip')">
      跳過
    </PixelButton>
  </div>
</template>

<style scoped>
.control-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
}

.control-bar__side {
  min-width: calc(var(--touch-min) + var(--space-2));
}
</style>
