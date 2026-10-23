// 用量報告的計算與文字（純函式，不連網路），給 scripts/usage.mjs 用，也方便測試。

/** Cloudflare 免費方案每天的額度（00:00 UTC 重置，台灣早上 8 點） */
export const CLOUDFLARE_DAILY_LIMIT = 100_000
/** GitHub Actions：public repo 不計費；改成 private 時免費帳號每月 2,000 分鐘 */
export const GITHUB_PRIVATE_MONTHLY_MINUTES = 2_000

export const NOTICE_RATIO = 0.5
export const WARNING_RATIO = 0.8

/** @returns {'ok' | 'notice' | 'warning'} */
export function levelOf(used, limit) {
  const ratio = limit > 0 ? used / limit : 0
  if (ratio >= WARNING_RATIO) return 'warning'
  if (ratio >= NOTICE_RATIO) return 'notice'
  return 'ok'
}

const MARK = { ok: '✔', notice: '⚠ 已用超過一半', warning: '✘ 快用完了' }

function percent(used, limit) {
  return `${((used / limit) * 100).toFixed(1)}%`
}

function count(n) {
  return n.toLocaleString('en-US')
}

/** GitHub Actions 每次執行的分鐘數，無條件進位（GitHub 也是這樣算） */
export function runMinutes(run) {
  const start = Date.parse(run.run_started_at ?? run.created_at)
  const end = Date.parse(run.updated_at)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.ceil((end - start) / 60_000)
}

/**
 * @param {{
 *   cloudflare: null | { workerRequests: number, durableRequests: number, errors: number },
 *   github: null | { runs: number, minutes: number, isPrivate: boolean },
 * }} usage
 * @returns {{ lines: string[], level: 'ok' | 'notice' | 'warning' }}
 */
export function buildReport({ cloudflare, github }) {
  const lines = []
  const levels = []

  lines.push('Cloudflare（Free 方案，每天台灣早上 8 點重置）')
  if (cloudflare) {
    for (const [label, used] of [
      ['推播伺服器請求', cloudflare.workerRequests],
      ['Durable Object 請求', cloudflare.durableRequests],
    ]) {
      const level = levelOf(used, CLOUDFLARE_DAILY_LIMIT)
      levels.push(level)
      lines.push(
        `  ${label}：${count(used)} / ${count(CLOUDFLARE_DAILY_LIMIT)}（${percent(used, CLOUDFLARE_DAILY_LIMIT)}）${MARK[level]}`,
      )
    }
    lines.push(`  錯誤：${count(cloudflare.errors)}`)
  } else {
    lines.push('  讀不到（請先在 push-worker 執行 npx wrangler login）')
  }

  lines.push('GitHub Actions（本月）')
  if (github) {
    const minutesLine = `  部署 ${count(github.runs)} 次，共 ${count(github.minutes)} 分鐘`
    if (github.isPrivate) {
      const level = levelOf(github.minutes, GITHUB_PRIVATE_MONTHLY_MINUTES)
      levels.push(level)
      lines.push(
        `${minutesLine}（private repo 免費額度 ${count(GITHUB_PRIVATE_MONTHLY_MINUTES)} 分鐘：${percent(github.minutes, GITHUB_PRIVATE_MONTHLY_MINUTES)}）${MARK[level]}`,
      )
    } else {
      lines.push(`${minutesLine}（public repo 不計費 ✔）`)
    }
  } else {
    lines.push('  讀不到（GitHub API 暫時無法連線）')
  }

  lines.push('每月手動確認：Cloudflare 與 GitHub 都是免費方案、而且沒有綁付款方式')

  const level = levels.includes('warning') ? 'warning' : levels.includes('notice') ? 'notice' : 'ok'
  const summary = {
    ok: '結果：✔ 一切在免費額度內',
    notice: '結果：⚠ 有項目用超過一半，留意一下',
    warning: '結果：✘ 有項目快用完了；推播伺服器可以先把 PUSH_ENABLED 改成 false 止血',
  }[level]
  lines.push(summary)
  return { lines, level }
}
