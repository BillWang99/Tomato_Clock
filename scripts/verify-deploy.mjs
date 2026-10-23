// 推上 main 之後跑這支：等 GitHub Actions 部署完，再確認正式網站真的換成這一版。
// 一個指令做完「等部署 + 檢查網站」，不用開瀏覽器。
//
// 用法：node scripts/verify-deploy.mjs [commit]（預設是目前的 HEAD）
// 成功回傳 0；部署失敗、逾時、網站檔案打不開或還是舊版都回傳 1。
//
// GitHub 不登入的查詢每小時只有 60 次。有設定環境變數 GITHUB_TOKEN 就帶著查（每小時 5,000 次）；
// 額度用完時改看網站本身的更新時間，確認推上去之後有重新部署過。

import { execSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRateLimited, resetTimeText, siteUpdatedSince } from './lib/deployCheck.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'BillWang99/Tomato_Clock'
const SITE = 'https://billwang99.github.io/Tomato_Clock/'
// 每 15 秒查一次：一次部署約 1～2 分鐘，最多十來次，不會把每小時 60 次的額度用光
const POLL_MS = 15_000
const TIMEOUT_MS = 6 * 60_000

const git = (args) => execSync(`git ${args}`, { cwd: ROOT }).toString().trim()
const sha = git(`rev-parse ${process.argv[2] ?? 'HEAD'}`)
const commitTime = Number(git(`log -1 --format=%ct ${sha}`))
const started = Date.now()
const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class RateLimitError extends Error {}

async function getJson(url) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const response = await fetch(url, { headers })
  if (isRateLimited(response.status, response.headers)) {
    throw new RateLimitError(resetTimeText(response.headers))
  }
  if (!response.ok) throw new Error(`GitHub API ${response.status}：${url}`)
  return response.json()
}

// GitHub API 的 head_sha 一定要完整 40 碼，短碼會永遠查不到
async function waitForRun() {
  let lastStatus = ''
  while (Date.now() - started < TIMEOUT_MS) {
    const { workflow_runs: runs } = await getJson(
      `https://api.github.com/repos/${REPO}/actions/runs?head_sha=${sha}`,
    )
    const run = runs[0]
    const status = run ? `${run.status}${run.conclusion ? `／${run.conclusion}` : ''}` : '排隊中'
    if (status !== lastStatus) console.log(`[${elapsed()}] 部署：${status}`)
    lastStatus = status
    if (run?.status === 'completed') return run
    await sleep(POLL_MS)
  }
  throw new Error(`等了 ${TIMEOUT_MS / 60_000} 分鐘還沒部署完`)
}

// 查不了 GitHub 時的備案：等到網站的 Last-Modified 晚於這個 commit
async function waitForSiteUpdate() {
  while (Date.now() - started < TIMEOUT_MS) {
    const response = await fetch(`${SITE}?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
    const lastModified = response.headers.get('last-modified')
    if (siteUpdatedSince(lastModified, commitTime)) {
      console.log(`[${elapsed()}] 網站已在推送後重新部署（最後更新 ${lastModified}）`)
      return
    }
    await sleep(POLL_MS)
  }
  throw new Error(`等了 ${TIMEOUT_MS / 60_000} 分鐘，網站還沒更新`)
}

async function printFailedSteps(run) {
  try {
    const { jobs } = await getJson(run.jobs_url)
    for (const job of jobs) {
      for (const step of job.steps ?? []) {
        if (step.conclusion === 'failure') console.log(`  失敗步驟：${job.name} → ${step.name}`)
      }
    }
  } catch {
    // 查不到失敗步驟就只給連結
  }
}

async function status(url) {
  const response = await fetch(url, { cache: 'no-store' })
  return response.status
}

// 正式網站的 index.html 引用的 JS／CSS 檔名，要跟本機這一版建置出來的一樣，才代表新版已經上線
async function checkSite() {
  const html = await (await fetch(SITE, { cache: 'no-store' })).text()
  const assets = [...html.matchAll(/\/Tomato_Clock\/(assets\/[^"]+)/g)].map((m) => m[1])
  // Service Worker 由 App 自己註冊（src/composables/useAppUpdate.ts），所以沒有 registerSW.js
  const files = ['', 'sw.js', 'push-sw.js', 'manifest.webmanifest', ...assets]
  const results = await Promise.all(
    files.map(async (file) => [file || '/', await status(SITE + file)]),
  )
  const broken = results.filter(([, code]) => code !== 200)
  for (const [file, code] of results) console.log(`  ${code} ${file}`)

  let sameVersion = null
  try {
    const local = await readFile(join(ROOT, 'dist/index.html'), 'utf8')
    const localAssets = [...local.matchAll(/\/Tomato_Clock\/(assets\/[^"]+)/g)].map((m) => m[1])
    sameVersion = localAssets.length > 0 && localAssets.every((asset) => assets.includes(asset))
  } catch {
    // 本機沒有建置結果就略過版本比對
  }
  return { broken, sameVersion }
}

try {
  console.log(`檢查 ${sha.slice(0, 7)} 的部署`)
  try {
    const run = await waitForRun()
    if (run.conclusion !== 'success') {
      console.log(`✘ 部署失敗：${run.html_url}`)
      await printFailedSteps(run)
      process.exit(1)
    }
    console.log(`✔ 部署成功（${elapsed()}）：${run.html_url}`)
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error
    console.log(
      `[${elapsed()}] GitHub 查詢額度用完了（每小時 60 次，${error.message} 重置），改看網站更新時間`,
    )
    await waitForSiteUpdate()
    console.log('  （查不到部署結果；部署失敗的話網站不會更新，會等到逾時）')
  }

  const { broken, sameVersion } = await checkSite()
  if (broken.length > 0) {
    console.log(`✘ 網站有 ${broken.length} 個檔案打不開`)
    process.exit(1)
  }
  if (sameVersion === false) {
    console.log('✘ 網站上的檔案跟本機建置不同：可能還在更新快取，或本機 dist 不是這一版')
    process.exit(1)
  }
  const versionNote = sameVersion ? '，而且是這一版' : '（本機沒有 dist，略過版本比對）'
  console.log(`✔ 網站檔案都打得開${versionNote}（共 ${elapsed()}）`)
} catch (error) {
  console.log(`✘ ${error.message}`)
  process.exit(1)
}
