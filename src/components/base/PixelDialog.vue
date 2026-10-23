<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import PixelButton from './PixelButton.vue'

const props = defineProps<{
  open: boolean
  title: string
  closeLabel: string
}>()

const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)

// 用原生 <dialog>：鍵盤 Esc、焦點鎖定、螢幕閱讀器都由瀏覽器處理
function sync(): void {
  const el = dialog.value
  if (!el) return
  if (props.open && !el.open) el.showModal?.()
  if (!props.open && el.open) el.close?.()
}

// 點到對話框外面的半透明背景也關閉
function onBackdropClick(event: MouseEvent): void {
  if (event.target === dialog.value) emit('close')
}

watch(() => props.open, sync)
onMounted(sync)
</script>

<template>
  <dialog
    ref="dialog"
    class="pixel-dialog"
    :aria-label="title"
    @close="emit('close')"
    @click="onBackdropClick"
  >
    <div class="pixel-dialog__sheet">
      <header class="pixel-dialog__header">
        <h2 class="pixel-dialog__title">{{ title }}</h2>
        <PixelButton @click="emit('close')">{{ closeLabel }}</PixelButton>
      </header>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
/* 手機上是從底部滑出的面板，拇指搆得到 */
.pixel-dialog {
  width: 100%;
  max-width: var(--content-max);
  max-height: 88dvh;
  margin: auto auto 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text);
}

.pixel-dialog::backdrop {
  background: rgb(26 28 44 / 0.72);
}

.pixel-dialog[open] {
  animation: sheet-up var(--duration-base) steps(4);
}

.pixel-dialog__sheet {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 88dvh;
  overflow-y: auto;
  padding: var(--space-2) var(--space-2) calc(var(--space-2) + env(safe-area-inset-bottom));
  background: var(--color-surface);
  box-shadow:
    inset 0 var(--px) 0 0 var(--color-phase-light),
    inset 0 calc(var(--px) * 2) 0 0 var(--color-edge);
}

.pixel-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pixel-dialog__title {
  font-size: var(--font-lg);
  font-weight: normal;
}

@keyframes sheet-up {
  from {
    transform: translateY(40%);
    opacity: 0;
  }
}

@media (min-width: 600px) {
  .pixel-dialog {
    margin: auto;
  }
}
</style>
