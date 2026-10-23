// 呼叫推播伺服器。只負責發請求，失敗時丟出看得懂的中文錯誤，不碰畫面。

import { PUSH_API_URL } from '@/core/pushConfig'
import type { Phase } from '@/core/timer'

export interface PushSubscriptionData {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const TIMEOUT_MS = 8000
/** 伺服器總開關關閉時回的文字；伺服器暫時出錯也是 503，但文字不同 */
const PAUSED_MESSAGE = '推播暫停服務'

async function errorText(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : ''
  } catch {
    return ''
  }
}

/** 伺服器回 410：推播服務說這個訂閱已失效，要重新訂閱 */
export class PushGoneError extends Error {
  constructor() {
    super('推播訂閱已失效')
  }
}

async function post(path: string, body: unknown): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${PUSH_API_URL}${path}`, {
      method: 'POST',
      // 用 text/plain 是「簡單請求」，瀏覽器不用每次先送一個預檢請求，伺服器一樣當 JSON 讀
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(body),
      // 頁面被凍結（例如按完開始馬上鎖螢幕）時，瀏覽器也會把這個請求送完
      keepalive: true,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new Error('連不上推播伺服器，這次時間到不會跳通知')
  }
  if (response.status === 410) throw new PushGoneError()
  if (response.status === 429) throw new Error('操作太頻繁，這次時間到不會跳通知')
  if (response.status === 503 && (await errorText(response)) === PAUSED_MESSAGE) {
    throw new Error('推播暫停服務中，這次時間到不會跳通知')
  }
  if (!response.ok) throw new Error('推播伺服器出錯，這次時間到不會跳通知')
}

export function schedulePush(
  subscription: PushSubscriptionData,
  delayMs: number,
  phase: Phase,
  token: string,
): Promise<void> {
  return post('/api/schedule', { subscription, delayMs, phase, token })
}

export function cancelPush(endpoint: string, token: string): Promise<void> {
  return post('/api/cancel', { endpoint, token })
}
