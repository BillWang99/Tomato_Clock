// 檢查前端送來的資料。這個 API 不用登入、誰都能呼叫，所以每個欄位都要擋：
// 只對真正的推播服務發請求（不能被拿來打任意網址）、時間有上限、文字由伺服器產生。

export type Phase = 'focus' | 'shortBreak' | 'longBreak'

export interface Subscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface ScheduleRequest {
  subscription: Subscription
  delayMs: number
  phase: Phase
  token: string
}

export interface CancelRequest {
  endpoint: string
  token: string
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

/** 時長最長 99:59，多留一點緩衝 */
export const MIN_DELAY_MS = 1_000
export const MAX_DELAY_MS = 100 * 60_000

const PHASES: readonly Phase[] = ['focus', 'shortBreak', 'longBreak']

// 各家瀏覽器的推播服務網址；不在名單裡的一律拒絕
const PUSH_HOST_PATTERNS: readonly RegExp[] = [
  /^web\.push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
]

const BASE64URL = /^[A-Za-z0-9_-]+$/
/** 訂閱公鑰是 65 bytes 的未壓縮 P-256 點（第一個 byte 是 0x04），驗證密鑰是 16 bytes */
const P256_POINT_BYTES = 65
const AUTH_SECRET_BYTES = 16
const TOKEN = /^[A-Za-z0-9_-]{1,64}$/

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1024) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && PUSH_HOST_PATTERNS.some((p) => p.test(url.hostname))
  } catch {
    return false
  }
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!BASE64URL.test(value) || value.length > 128) return null
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

// 實際解碼檢查長度：格式像但內容不對的金鑰，到時間要加密時才會出錯，所以在這裡就擋掉
function isValidKeys(p256dh: unknown, auth: unknown): boolean {
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return false
  const point = decodeBase64Url(p256dh)
  const secret = decodeBase64Url(auth)
  return (
    point?.length === P256_POINT_BYTES && point[0] === 0x04 && secret?.length === AUTH_SECRET_BYTES
  )
}

function parseSubscription(value: unknown): Subscription | null {
  if (!isObject(value) || !isPushEndpoint(value.endpoint) || !isObject(value.keys)) return null
  const { p256dh, auth } = value.keys
  if (!isValidKeys(p256dh, auth)) return null
  return { endpoint: value.endpoint, keys: { p256dh: p256dh as string, auth: auth as string } }
}

export function parseSchedule(body: unknown): Result<ScheduleRequest> {
  if (!isObject(body)) return { ok: false, error: '格式錯誤' }
  const subscription = parseSubscription(body.subscription)
  if (!subscription) return { ok: false, error: '推播訂閱不正確' }
  const { delayMs, phase, token } = body
  if (typeof delayMs !== 'number' || !Number.isInteger(delayMs)) {
    return { ok: false, error: '提醒時間不正確' }
  }
  if (delayMs < MIN_DELAY_MS || delayMs > MAX_DELAY_MS) {
    return { ok: false, error: '提醒時間超出範圍' }
  }
  if (!PHASES.includes(phase as Phase)) return { ok: false, error: '階段不正確' }
  if (typeof token !== 'string' || !TOKEN.test(token)) return { ok: false, error: '編號不正確' }
  return { ok: true, value: { subscription, delayMs, phase: phase as Phase, token } }
}

export function parseCancel(body: unknown): Result<CancelRequest> {
  if (!isObject(body) || !isPushEndpoint(body.endpoint))
    return { ok: false, error: '推播訂閱不正確' }
  if (typeof body.token !== 'string' || !TOKEN.test(body.token)) {
    return { ok: false, error: '編號不正確' }
  }
  return { ok: true, value: { endpoint: body.endpoint, token: body.token } }
}
