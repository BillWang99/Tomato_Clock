/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// 會影響網站程式的檔案；只改 docs/、scripts/、push-worker/ 的 commit 不算
const APP_PATHS = [
  'src',
  'public',
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
]

// 建置時寫進程式的版本號，設定裡會顯示「v0.7.0（abc1234）」。用「最後一次改到網站程式的 commit」，
// 不用 HEAD：只改文件的 commit 建出來的檔案就完全一樣，使用者不會看到假的「有新版本」
function buildId(): string {
  const run = (cmd: string) =>
    execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  try {
    return (
      run(`git log -1 --format=%h -- ${APP_PATHS.join(' ')}`) || run('git rev-parse --short HEAD')
    )
  } catch {
    return 'dev'
  }
}

// GitHub Pages 專案頁的網址是 https://billwang99.github.io/Tomato_Clock/
export default defineConfig({
  base: '/Tomato_Clock/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(buildId()),
  },
  plugins: [
    vue(),
    // PWA：把整個網站存進手機，離線也能開。有新版時畫面上方問使用者要不要更新
    // （src/composables/useAppUpdate.ts）；計時狀態存在 localStorage，更新時不會中斷
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false, // 沿用 public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        // 推播通知的處理（public/push-sw.js）
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // GitHub 的機器比本機慢，留一點餘裕
    testTimeout: 15_000,
  },
})
