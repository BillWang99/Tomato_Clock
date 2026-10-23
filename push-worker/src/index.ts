// 推播小伺服器的入口：只有三個路徑，不用登入。
//   POST /api/schedule  排提醒
//   POST /api/cancel    取消提醒
//   GET  /api/health    給部署檢查用

import { AlertObject } from './alertObject'
import type { PushEnv } from './push'
import { parseCancel, parseSchedule } from './validate'

export { AlertObject }

export interface Env extends PushEnv {
  ALERTS: DurableObjectNamespace<AlertObject>
  RATE_LIMITER?: RateLimit
  ALLOWED_ORIGINS: string
  /** 總開關：設成 "false" 就暫停推播服務（被灌請求時止血用），網站計時不受影響 */
  PUSH_ENABLED?: string
}

export function isPushEnabled(env: Pick<Env, 'PUSH_ENABLED'>): boolean {
  return env.PUSH_ENABLED !== 'false'
}

const MAX_BODY_BYTES = 4096

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin')
  if (!origin) return null
  return env.ALLOWED_ORIGINS.split(',').includes(origin) ? origin : null
}

function json(status: number, body: unknown, origin: string | null): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' })
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers })
}

function preflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  })
}

// 網站送的是 text/plain（簡單請求，瀏覽器不用先送預檢），內容一樣是 JSON
async function readBody(request: Request): Promise<unknown> {
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > MAX_BODY_BYTES) return null
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function tooLarge(request: Request): boolean {
  const declared = Number(request.headers.get('Content-Length') ?? 0)
  return declared > MAX_BODY_BYTES
}

// Durable Object 用推播位址的雜湊命名：同一支手機永遠對到同一個，而且名稱裡看不出原本的網址
export async function alertName(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function alertStub(env: Env, endpoint: string) {
  return env.ALERTS.get(env.ALERTS.idFromName(await alertName(endpoint)))
}

// IPv6 一個用戶通常拿到整個 /64 網段，只看完整位址的話換個位址就能繞過頻率限制
export function rateLimitKey(ip: string): string {
  if (!ip.includes(':')) return ip
  const [head, tail = ''] = ip.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
  return `${groups
    .slice(0, 4)
    .map((g) => g.toLowerCase().replace(/^0+(?=.)/, ''))
    .join(':')}::/64`
}

async function isRateLimited(request: Request, env: Env): Promise<boolean> {
  if (!env.RATE_LIMITER) return false
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const { success } = await env.RATE_LIMITER.limit({ key: rateLimitKey(ip) })
  return !success
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = allowedOrigin(request, env)

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json(200, { ok: true, pushEnabled: isPushEnabled(env) }, origin)
    }
    if (!url.pathname.startsWith('/api/')) return json(404, { error: '找不到' }, origin)
    // 只接受蕃茄鐘網站呼叫（瀏覽器會帶 Origin）
    if (!origin) return json(403, { error: '不允許的來源' }, null)
    if (request.method === 'OPTIONS') return preflight(origin)
    if (request.method !== 'POST') return json(405, { error: '方法不允許' }, origin)
    // 總開關關著：連頻率限制和 Durable Object 都不碰，用量降到最低
    if (!isPushEnabled(env)) return json(503, { error: '推播暫停服務' }, origin)
    if (await isRateLimited(request, env)) return json(429, { error: '太頻繁了' }, origin)
    if (tooLarge(request)) return json(413, { error: '內容太大' }, origin)

    const body = await readBody(request)

    try {
      if (url.pathname === '/api/schedule') {
        const parsed = parseSchedule(body)
        if (!parsed.ok) return json(400, { error: parsed.error }, origin)
        const { subscription, delayMs, phase, token } = parsed.value
        const stub = await alertStub(env, subscription.endpoint)
        // 用伺服器時間算發送時刻，不相信手機時鐘
        const result = await stub.schedule({
          subscription,
          fireAt: Date.now() + delayMs,
          phase,
          token,
        })
        // 410：推播服務說這個訂閱已失效，App 要重新訂閱再排一次
        return result === 'gone'
          ? json(410, { error: '推播訂閱已失效' }, origin)
          : json(204, null, origin)
      }

      if (url.pathname === '/api/cancel') {
        const parsed = parseCancel(body)
        if (!parsed.ok) return json(400, { error: parsed.error }, origin)
        const stub = await alertStub(env, parsed.value.endpoint)
        await stub.cancel(parsed.value.token)
        return json(204, null, origin)
      }
    } catch {
      // Durable Object 暫時出錯也要帶 CORS 標頭，前端才拿得到「伺服器出錯」而不是「連不上」
      return json(503, { error: '伺服器暫時出錯' }, origin)
    }

    return json(404, { error: '找不到' }, origin)
  },
} satisfies ExportedHandler<Env>
