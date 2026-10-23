// 讓測試裡的 env 帶有 Worker 的綁定型別（ALERTS、VAPID_* 等）
import type { Env as WorkerEnv } from '../src/index'

declare global {
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 只是把 Worker 的 Env 併進測試的 env
    interface Env extends WorkerEnv {}
  }
}
