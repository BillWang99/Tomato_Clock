// 換新推播金鑰（VAPID）並留一份備份。這是遠端操作（會改 Cloudflare 上的推播伺服器）。
//
// 用法（請在要上線前、main 分支上執行）：
//   npm run vapid:rotate          只列出會做哪些事，不動任何東西
//   npm run vapid:rotate -- --yes 真的執行
//
// 執行時會：
// 1. 確認在 main 分支、兩個設定檔沒有改到一半
// 2. 產生新金鑰，私鑰存成桌面上一個只有你能讀的備份檔（請匯入密碼管理器後刪除）
// 3. 新公鑰與新私鑰「一次」部署到推播伺服器（沒有公私鑰對不上的空窗）
// 4. 部署成功才把新公鑰寫進 push-worker/wrangler.jsonc 與 src/core/pushConfig.ts
// 之後要馬上 commit 並把網站推上線：網站拿到新公鑰前，推播會暫時收不到。
// App 打開時發現訂閱是舊金鑰，會自動重新訂閱，使用者不用做任何事。

import { execSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  backupFileContent,
  generateVapidKeys,
  replaceSitePublicKey,
  replaceWranglerPublicKey,
} from './lib/vapidKeys.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_DIR = join(ROOT, 'push-worker')
const WRANGLER_CONFIG = join(WORKER_DIR, 'wrangler.jsonc')
const SITE_CONFIG = join(ROOT, 'src/core/pushConfig.ts')

const confirmed = process.argv.includes('--yes')
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
// 檔名用你電腦的當地時間、精確到秒，重跑也不會蓋掉之前的備份
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
const backupPath = join(homedir(), 'Desktop', `tomato-clock-推播私鑰-${stamp}.txt`)

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim()
}

// 線上推播伺服器一換金鑰，網站就要盡快拿到新公鑰；在還沒合併的分支上換，推播會一直壞到合併上線
function preflightProblems() {
  const problems = []
  const branch = git('rev-parse --abbrev-ref HEAD')
  if (branch !== 'main') problems.push(`目前在 ${branch} 分支，請先合併到 main 再換金鑰`)
  const dirty = git('status --porcelain -- push-worker/wrangler.jsonc src/core/pushConfig.ts')
  if (dirty) problems.push('wrangler.jsonc 或 pushConfig.ts 有還沒 commit 的改動，請先處理')
  return problems
}

if (!confirmed) {
  console.log(`將會：
  1. 確認在 main 分支、設定檔沒有改到一半
  2. 產生新的推播金鑰，私鑰備份到 ${backupPath}（只有你能讀）
  3. 新公鑰與新私鑰一次部署到推播伺服器
  4. 部署成功後更新 wrangler.jsonc 與 src/core/pushConfig.ts 的公鑰
做完要馬上 commit 並把網站推上線。確定要換，請執行：npm run vapid:rotate -- --yes`)
  process.exit(0)
}

const problems = preflightProblems()
if (problems.length > 0) {
  console.log(`✘ 先不換：\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}

const keys = await generateVapidKeys()

// 先備份：就算後面部署失敗，也不會有「上傳了卻沒留底」的私鑰。wx：檔案已存在就報錯，不覆蓋
await writeFile(
  backupPath,
  backupFileContent({ ...keys, createdAt: now.toLocaleString('zh-TW') }),
  { mode: 0o600, flag: 'wx' },
)
console.log(`✔ 私鑰已備份到 ${backupPath}`)

// 私鑰放進只有你能讀的暫存檔交給 wrangler（不會出現在指令參數或畫面上），部署完立刻刪掉
const secretsDir = await mkdtemp(join(tmpdir(), 'tomato-vapid-'))
const secretsFile = join(secretsDir, 'secrets.json')
try {
  await writeFile(secretsFile, JSON.stringify({ VAPID_PRIVATE_KEY: keys.privateKey }), {
    mode: 0o600,
    flag: 'wx',
  })
  // 公鑰是公開資訊，可以放在指令參數；一次部署同時換公鑰與私鑰
  execSync(
    `npx wrangler deploy --var VAPID_PUBLIC_KEY:${keys.publicKey} --secrets-file "${secretsFile}"`,
    {
      cwd: WORKER_DIR,
      stdio: ['ignore', 'ignore', 'inherit'],
      // 強制 wrangler 遮蔽記錄裡的秘密，就算你平常開了 debug log 也一樣
      env: { ...process.env, WRANGLER_LOG_SANITIZE: 'true' },
    },
  )
} catch {
  console.log(`✘ 部署失敗：線上推播伺服器沒有變動，推播照舊可以用。
  ${backupPath} 是沒用上的新金鑰，可以直接刪掉；查完原因（例如 npx wrangler login）再重跑一次。`)
  process.exit(1)
} finally {
  await rm(secretsDir, { recursive: true, force: true })
}
console.log('✔ 推播伺服器已用新金鑰部署（公鑰與私鑰同時生效）')

// 部署成功才改設定檔，之後一般的 wrangler deploy 也會用同一把公鑰
await writeFile(
  WRANGLER_CONFIG,
  replaceWranglerPublicKey(await readFile(WRANGLER_CONFIG, 'utf8'), keys.publicKey),
)
await writeFile(
  SITE_CONFIG,
  replaceSitePublicKey(await readFile(SITE_CONFIG, 'utf8'), keys.publicKey),
)
console.log('✔ 新公鑰已寫進 wrangler.jsonc 與 src/core/pushConfig.ts')

console.log(`
接下來（請馬上做）：
  1. commit 並把網站推上線：網站拿到新公鑰前，推播會暫時收不到
  2. 打開 ${backupPath}，把私鑰存進密碼管理器，然後刪掉這個檔案`)
