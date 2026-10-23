<script setup lang="ts">
import PixelButton from '@/components/base/PixelButton.vue'

const emit = defineEmits<{ update: []; dismiss: [] }>()
</script>

<template>
  <div class="update-banner" role="status">
    <p class="update-banner__text">
      有新版本
      <small class="update-banner__note">更新後計時會從原本的進度繼續</small>
    </p>
    <div class="update-banner__actions">
      <PixelButton @click="emit('dismiss')">稍後</PixelButton>
      <PixelButton variant="primary" @click="emit('update')">立即更新</PixelButton>
    </div>
  </div>
</template>

<style scoped>
/* 固定在畫面上方，出現時不推動下面的版面 */
.update-banner {
  position: fixed;
  top: calc(env(safe-area-inset-top) + var(--space-2));
  right: var(--space-2);
  left: var(--space-2);
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1);
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-1) var(--space-2);
  background: var(--c-sky);
  color: var(--c-ink);
  box-shadow:
    0 calc(var(--px) * -1) 0 0 var(--color-edge),
    0 var(--px) 0 0 var(--color-edge),
    calc(var(--px) * -1) 0 0 0 var(--color-edge),
    var(--px) 0 0 0 var(--color-edge);
  animation: drop-in var(--duration-base) steps(4);
}

.update-banner__text {
  display: flex;
  flex-direction: column;
  font-size: var(--font-md);
}

.update-banner__note {
  font-size: var(--font-sm);
}

.update-banner__actions {
  display: flex;
  gap: var(--space-half);
  margin-left: auto;
}

@keyframes drop-in {
  from {
    transform: translateY(-50%);
    opacity: 0;
  }
}
</style>
