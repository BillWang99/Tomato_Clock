import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// 測試用的 VAPID 金鑰每次跑測試時臨時產生，不寫進 repo
const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])
const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          VAPID_PUBLIC_KEY: Buffer.from(publicRaw).toString('base64url'),
          VAPID_PRIVATE_KEY: privateJwk.d as string,
        },
      },
    }),
  ],
})
