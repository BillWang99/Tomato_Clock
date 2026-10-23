// 一個指令看外部服務的用量，對照免費額度。只讀取，不改任何設定。
// 用法：npm run usage
// - Cloudflare：用你電腦上已登入的 wrangler 授權讀今天的統計（不需要另外申請金鑰）
// - GitHub：用公開 API 讀本月的部署紀錄
// 結束代碼：0 = 正常或只是提醒；1 = 有項目超過免費額度 80%

import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildReport, runMinutes } from './lib/usageReport.mjs'

// 從任何資料夾執行都找得到 push-worker（wrangler 要在那裡跑才讀得到登入授權與設定）
const WORKER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'push-worker')

const REPO = 'BillWang99/Tomato_Clock'
const WORKER = 'tomato-push'

// wrangler 會在需要時自動換新授權；token 只在這支程式的記憶體裡用，不印出來
function cloudflareToken() {
  try {
    const output = execSync('npx wrangler auth token', {
      cwd: WORKER_DIR,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString()
    return output.trim().split('\n').at(-1).trim() || null
  } catch {
    return null
  }
}

async function cloudflareJson(token, path, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return response.json()
}

async function cloudflareUsage() {
  const token = cloudflareToken()
  if (!token) return null
  const accounts = await cloudflareJson(token, '/accounts')
  const accountTag = accounts.result?.[0]?.id
  if (!accountTag) {
    // 錯誤訊息裡不會有 token，可以放心印出來
    console.error(`Cloudflare 帳號讀不到：${accounts.errors?.[0]?.message ?? '未知原因'}`)
    return null
  }

  // 免費額度每天 00:00 UTC 重置，所以從今天 UTC 零點算起
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const query = `query($acc: String!, $since: Time!, $until: Time!) {
    viewer { accounts(filter: {accountTag: $acc}) {
      workers: workersInvocationsAdaptive(limit: 10, filter: {datetime_geq: $since, datetime_leq: $until, scriptName: "${WORKER}"}) { sum { requests errors } }
      durable: durableObjectsInvocationsAdaptiveGroups(limit: 10, filter: {datetime_geq: $since, datetime_leq: $until}) { sum { requests } }
    } } }`
  const data = await cloudflareJson(token, '/graphql', {
    query,
    variables: { acc: accountTag, since: since.toISOString(), until: new Date().toISOString() },
  })
  const account = data.data?.viewer?.accounts?.[0]
  if (!account) {
    console.error(`Cloudflare 用量讀不到：${data.errors?.[0]?.message ?? '未知原因'}`)
    return null
  }
  const sum = (rows, key) => rows.reduce((total, row) => total + (row.sum?.[key] ?? 0), 0)
  return {
    workerRequests: sum(account.workers, 'requests'),
    durableRequests: sum(account.durable, 'requests'),
    errors: sum(account.workers, 'errors'),
  }
}

async function githubUsage() {
  const headers = { Accept: 'application/vnd.github+json' }
  const repo = await (await fetch(`https://api.github.com/repos/${REPO}`, { headers })).json()
  if (typeof repo.private !== 'boolean') return null
  const now = new Date()
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const url = `https://api.github.com/repos/${REPO}/actions/runs?created=>=${monthStart}&per_page=100`
  const { workflow_runs: runs = [] } = await (await fetch(url, { headers })).json()
  return {
    runs: runs.length,
    minutes: runs.reduce((total, run) => total + runMinutes(run), 0),
    isPrivate: repo.private,
  }
}

const [cloudflare, github] = await Promise.all([
  cloudflareUsage().catch(() => null),
  githubUsage().catch(() => null),
])
const { lines, level } = buildReport({ cloudflare, github })
console.log(lines.join('\n'))
process.exit(level === 'warning' ? 1 : 0)
