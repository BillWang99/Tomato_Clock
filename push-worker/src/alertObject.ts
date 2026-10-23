// 每個推播訂閱一個 Durable Object，裡面最多一筆「待發提醒」。
// 用 alarm 在時間到的那一刻醒來發推播，發完（或取消）立刻刪資料，伺服器上不留任何東西。

import { DurableObject } from 'cloudflare:workers'
import { sendPush, type PushEnv } from './push'
import type { Phase, Subscription } from './validate'

export interface PendingAlert {
  subscription: Subscription
  fireAt: number
  phase: Phase
  token: string
}

export type ScheduleResult = 'scheduled' | 'gone'

const KEY = 'alert'
/** 推播服務說這個訂閱已失效時留下的記號（只有 true，不含訂閱資料），下次排程時告訴 App 要重新訂閱 */
const GONE_KEY = 'gone'
/** 推播服務暫時出錯時，時間到後 30 秒內還可以重試；再晚就算了 */
const RETRY_WINDOW_MS = 30_000

export class AlertObject extends DurableObject<PushEnv> {
  /** 排提醒：新的直接取代舊的（同一支手機同時只會有一個計時） */
  async schedule(alert: PendingAlert): Promise<ScheduleResult> {
    if (await this.ctx.storage.get<boolean>(GONE_KEY)) {
      await this.clear()
      return 'gone'
    }
    await this.ctx.storage.put(KEY, alert)
    await this.ctx.storage.setAlarm(alert.fireAt)
    return 'scheduled'
  }

  /** 取消提醒：編號對上才刪，避免晚到的「取消」把新排的提醒刪掉 */
  async cancel(token: string): Promise<boolean> {
    const alert = await this.ctx.storage.get<PendingAlert>(KEY)
    if (!alert || alert.token !== token) return false
    await this.clear()
    return true
  }

  async pending(): Promise<PendingAlert | null> {
    return (await this.ctx.storage.get<PendingAlert>(KEY)) ?? null
  }

  async alarm(): Promise<void> {
    const alert = await this.ctx.storage.get<PendingAlert>(KEY)
    if (!alert) return
    // 重試時可能已經換成還沒到時間的新提醒：把鬧鐘調回它的時間，不提早發
    if (alert.fireAt > Date.now()) {
      await this.ctx.storage.setAlarm(alert.fireAt)
      return
    }

    const outcome = await sendPush(this.env, alert.subscription, alert.phase)

    // 等推播服務回應的這段時間，Durable Object 會繼續處理別的請求。
    // 如果期間 App 排了下一段（自動開始），那筆是新的，連同它的鬧鐘都不能刪
    const current = await this.ctx.storage.get<PendingAlert>(KEY)
    if (current?.token !== alert.token) return

    // 丟出錯誤會讓 Cloudflare 稍後自動重試 alarm
    if (outcome === 'retry' && Date.now() - alert.fireAt < RETRY_WINDOW_MS) {
      throw new Error('推播服務暫時無法使用，稍後重試')
    }
    await this.clear()
    if (outcome === 'gone') await this.ctx.storage.put(GONE_KEY, true)
  }

  private async clear(): Promise<void> {
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
  }
}
