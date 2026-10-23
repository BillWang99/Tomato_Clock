// 部署檢查的判斷（純函式，不連網路），給 scripts/verify-deploy.mjs 用，也方便測試。

/** GitHub 不登入的查詢每小時只有 60 次；額度用完時回 403（或 429），剩餘次數是 0 */
export function isRateLimited(status, headers) {
  if (status === 429) return true
  return status === 403 && headers.get('x-ratelimit-remaining') === '0'
}

/** 額度什麼時候重置，給人看的時間（例如 07:48） */
export function resetTimeText(headers) {
  const reset = Number(headers.get('x-ratelimit-reset'))
  if (!Number.isFinite(reset) || reset <= 0) return '約一小時內'
  const date = new Date(reset * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 網站（GitHub Pages）的 Last-Modified 晚於這個 commit 的時間，代表推上去之後已經重新部署過。
 * commit 一定比推送早、推送一定比部署早，所以這個比較不會誤判成「已部署」
 */
export function siteUpdatedSince(lastModified, commitEpochSeconds) {
  const modified = Date.parse(lastModified ?? '')
  if (!Number.isFinite(modified)) return false
  return modified / 1000 >= commitEpochSeconds
}
