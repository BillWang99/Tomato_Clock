// 組通知內容並發送 Web Push。通知文字由伺服器依階段決定，前端不能指定。
// 加密用 RFC 8291 的 aes128gcm、驗證用 RFC 8292 的 vapid：Apple 只收這兩種。

import { buildPushPayload } from '@block65/webcrypto-web-push'
import type { Phase, Subscription } from './validate'

export interface PushEnv {
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
}

const MESSAGES: Readonly<Record<Phase, { title: string; body: string }>> = Object.freeze({
  focus: { title: '🍅 專注完成！', body: '休息一下吧' },
  shortBreak: { title: '⏰ 休息結束', body: '回來專注囉' },
  longBreak: { title: '⏰ 長休息結束', body: '新的一輪開始' },
})

/** 推播服務 5 分鐘內送不到就丟掉：遲到半小時的「時間到」沒有意義 */
const TTL_SECONDS = 5 * 60

export type PushOutcome = 'sent' | 'gone' | 'retry' | 'failed'

export function notificationFor(phase: Phase) {
  return { ...MESSAGES[phase], tag: 'tomato-timer' }
}

export async function sendPush(
  env: PushEnv,
  subscription: Subscription,
  phase: Phase,
): Promise<PushOutcome> {
  let payload: Awaited<ReturnType<typeof buildPushPayload>>
  try {
    payload = await buildPushPayload(
      { data: notificationFor(phase), options: { ttl: TTL_SECONDS, urgency: 'high' } },
      { ...subscription, expirationTime: null },
      {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
      },
    )
  } catch {
    // 金鑰不對（訂閱壞掉、或部署時忘了設 VAPID 金鑰）重試也沒用，直接放棄並刪資料
    return 'failed'
  }
  try {
    const response = await fetch(subscription.endpoint, payload)
    if (response.ok) return 'sent'
    // 404／410：使用者取消了通知或訂閱過期，這筆就不用再試
    if (response.status === 404 || response.status === 410) return 'gone'
    return response.status >= 500 || response.status === 429 ? 'retry' : 'failed'
  } catch {
    return 'retry'
  }
}
