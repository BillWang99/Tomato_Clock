import { env, runInDurableObject, SELF } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertObject, PendingAlert } from '../src/alertObject'
import { alertName } from '../src/index'

const ORIGIN = 'https://billwang99.github.io'
// 測試之間的 Durable Object 資料不會自動清空，每個測試用一個新的推播網址，互不影響
let ENDPOINT = ''

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

// 推播加密需要一組真的 P-256 公鑰，模擬手機瀏覽器產生的訂閱
async function makeSubscription(endpoint = ENDPOINT) {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const raw = (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer
  return {
    endpoint,
    keys: { p256dh: base64url(raw), auth: base64url(crypto.getRandomValues(new Uint8Array(16))) },
  }
}

async function call(path: string, body: unknown, origin: string | null = ORIGIN) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (origin) headers.Origin = origin
  return SELF.fetch(`https://tomato-push.test${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function stubFor(endpoint = ENDPOINT) {
  return env.ALERTS.get(env.ALERTS.idFromName(await alertName(endpoint)))
}

async function pending(endpoint = ENDPOINT): Promise<PendingAlert | null> {
  return runInDurableObject(await stubFor(endpoint), (instance: AlertObject) => instance.pending())
}

async function alarmTime(endpoint = ENDPOINT): Promise<number | null> {
  return runInDurableObject(await stubFor(endpoint), (_: AlertObject, state) =>
    state.storage.getAlarm(),
  )
}

// 測試裡不等真的 1 分鐘：把提醒時間改成「現在」，再立刻觸發 alarm
async function fireNow(endpoint = ENDPOINT): Promise<void> {
  await runInDurableObject(await stubFor(endpoint), async (instance: AlertObject, state) => {
    const alert = await state.storage.get<PendingAlert>('alert')
    if (alert) await state.storage.put('alert', { ...alert, fireAt: Date.now() })
    await instance.alarm()
  })
}

beforeEach(() => {
  ENDPOINT = `https://web.push.apple.com/test-${crypto.randomUUID()}`
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('排程與取消', () => {
  it('排一個 25 分鐘的專注提醒：伺服器用自己的時間算出發送時刻並設好 alarm', async () => {
    const subscription = await makeSubscription()
    const before = Date.now()
    const response = await call('/api/schedule', {
      subscription,
      delayMs: 25 * 60_000,
      phase: 'focus',
      token: 'run-1',
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)

    const alert = await pending()
    expect(alert?.token).toBe('run-1')
    expect(alert?.fireAt).toBeGreaterThanOrEqual(before + 25 * 60_000)
    expect(await alarmTime()).toBe(alert?.fireAt)
  })

  it('同一支手機再排一次：新的取代舊的', async () => {
    const subscription = await makeSubscription()
    await call('/api/schedule', { subscription, delayMs: 60_000, phase: 'focus', token: 'run-1' })
    await call('/api/schedule', {
      subscription,
      delayMs: 300_000,
      phase: 'shortBreak',
      token: 'run-2',
    })
    const alert = await pending()
    expect(alert?.token).toBe('run-2')
    expect(alert?.phase).toBe('shortBreak')
  })

  it('取消時編號不對（晚到的舊取消）不會刪掉新提醒；編號對了才刪', async () => {
    const subscription = await makeSubscription()
    await call('/api/schedule', { subscription, delayMs: 60_000, phase: 'focus', token: 'run-2' })

    expect((await call('/api/cancel', { endpoint: ENDPOINT, token: 'run-1' })).status).toBe(204)
    expect((await pending())?.token).toBe('run-2')

    expect((await call('/api/cancel', { endpoint: ENDPOINT, token: 'run-2' })).status).toBe(204)
    expect(await pending()).toBeNull()
    expect(await alarmTime()).toBeNull()
  })

  it('不合法的資料回 400，什麼都不排', async () => {
    const subscription = await makeSubscription('https://evil.example.com/x')
    const response = await call('/api/schedule', {
      subscription,
      delayMs: 60_000,
      phase: 'focus',
      token: 'run-1',
    })
    expect(response.status).toBe(400)
  })
})

describe('來源限制', () => {
  it('沒有 Origin 或不是蕃茄鐘網站：403', async () => {
    const subscription = await makeSubscription()
    const body = { subscription, delayMs: 60_000, phase: 'focus', token: 'run-1' }
    expect((await call('/api/schedule', body, null)).status).toBe(403)
    expect((await call('/api/schedule', body, 'https://evil.example.com')).status).toBe(403)
    expect(await pending()).toBeNull()
  })

  it('瀏覽器的預檢請求（OPTIONS）回 204 並允許網站來源', async () => {
    const response = await SELF.fetch('https://tomato-push.test/api/schedule', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('健康檢查不用來源也能打', async () => {
    const response = await SELF.fetch('https://tomato-push.test/api/health')
    expect(await response.json()).toEqual({ ok: true })
  })
})

describe('時間到發推播', () => {
  it('alarm 醒來：對推播服務發一則加密推播（存活 5 分鐘、高優先），發完刪資料', async () => {
    const subscription = await makeSubscription()
    await call('/api/schedule', { subscription, delayMs: 60_000, phase: 'focus', token: 'run-1' })
    const sent = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 201 }))

    await fireNow()

    expect(sent).toHaveBeenCalledTimes(1)
    const [url, init] = sent.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(ENDPOINT)
    expect(init.method?.toUpperCase()).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('TTL')).toBe('300')
    expect(headers.get('Urgency')).toBe('high')
    expect(headers.get('Content-Encoding')).toBe('aes128gcm')
    expect(headers.get('Authorization')).toMatch(/^vapid t=.+, k=.+/)
    expect(await pending()).toBeNull()
  })

  it('推播服務說訂閱已失效（410）：直接刪掉，不再重試', async () => {
    const subscription = await makeSubscription()
    await call('/api/schedule', { subscription, delayMs: 60_000, phase: 'focus', token: 'run-1' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 410 }))

    await fireNow()
    expect(await pending()).toBeNull()
  })

  it('推播服務暫時出錯（503）且剛到時間：保留提醒、丟錯誤讓 Cloudflare 重試', async () => {
    const subscription = await makeSubscription()
    await call('/api/schedule', { subscription, delayMs: 60_000, phase: 'focus', token: 'run-1' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }))

    const stub = await stubFor()
    await runInDurableObject(stub, async (instance: AlertObject, state) => {
      const alert = (await state.storage.get<PendingAlert>('alert')) as PendingAlert
      await state.storage.put('alert', { ...alert, fireAt: Date.now() })
      await expect(instance.alarm()).rejects.toThrow()
    })
    expect((await pending())?.token).toBe('run-1')
  })

  it('發推播等回應的同時 App 排了下一段（自動開始）：新提醒和它的鬧鐘都要留著', async () => {
    const subscription = await makeSubscription()
    await call('/api/schedule', { subscription, delayMs: 60_000, phase: 'focus', token: 'run-1' })
    // 推播服務 300 毫秒才回應：這段時間裡 App 送來下一段的排程
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(new Response(null, { status: 201 })), 300),
        ),
    )

    const alarmRun = fireNow()
    await new Promise((resolve) => setTimeout(resolve, 100))
    const next = { subscription, delayMs: 300_000, phase: 'shortBreak', token: 'run-2' }
    expect((await call('/api/schedule', next)).status).toBe(204)
    await alarmRun

    const alert = await pending()
    expect(alert?.token).toBe('run-2')
    expect(await alarmTime()).toBe(alert?.fireAt)
  })

  it('存的金鑰壞掉、加密失敗：不重試、直接刪資料', async () => {
    const stub = await stubFor()
    await runInDurableObject(stub, async (instance: AlertObject, state) => {
      await state.storage.put('alert', {
        subscription: { endpoint: ENDPOINT, keys: { p256dh: 'AAAA', auth: 'AAAA' } },
        fireAt: Date.now(),
        phase: 'focus',
        token: 'bad',
      })
      await expect(instance.alarm()).resolves.toBeUndefined()
    })
    expect(await pending()).toBeNull()
  })

  it('時間還沒到就醒來（例如重試時已換成新提醒）：不發，把鬧鐘調回原本的時間', async () => {
    const subscription = await makeSubscription()
    await call('/api/schedule', { subscription, delayMs: 300_000, phase: 'focus', token: 'run-1' })
    const sent = vi.spyOn(globalThis, 'fetch')
    const stub = await stubFor()
    await runInDurableObject(stub, (instance: AlertObject) => instance.alarm())
    expect(sent).not.toHaveBeenCalled()
    expect(await alarmTime()).toBe((await pending())?.fireAt)
  })

  it('訂閱失效（410）後：下一次排程回 410 讓 App 重新訂閱，之後再排就正常', async () => {
    const subscription = await makeSubscription()
    await call('/api/schedule', { subscription, delayMs: 60_000, phase: 'focus', token: 'run-1' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 410 }))
    await fireNow()
    vi.restoreAllMocks()

    const body = { subscription, delayMs: 60_000, phase: 'focus', token: 'run-2' }
    expect((await call('/api/schedule', body)).status).toBe(410)
    expect(await pending()).toBeNull()
    expect((await call('/api/schedule', { ...body, token: 'run-3' })).status).toBe(204)
    expect((await pending())?.token).toBe('run-3')
  })
})

describe('請求大小', () => {
  it('宣告超過 4 KB 的請求直接 413，不讀內容', async () => {
    const response = await SELF.fetch('https://tomato-push.test/api/schedule', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'text/plain', 'Content-Length': '999999' },
      body: 'x',
    })
    expect(response.status).toBe(413)
  })
})
