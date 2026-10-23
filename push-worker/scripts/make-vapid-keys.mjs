// 產生一組 VAPID 金鑰（推播用的身分證明）。
// 公鑰可以公開：放進 wrangler.jsonc 的 VAPID_PUBLIC_KEY 與網站的 src/core/pushConfig.ts。
// 私鑰是秘密：只能用 `npx wrangler secret put VAPID_PRIVATE_KEY` 存進 Cloudflare，不要寫進任何檔案。
// 用法：npm run vapid

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
const publicKey = Buffer.from(raw).toString('base64url')

console.log('公鑰（可以公開）：')
console.log(publicKey)
console.log('\n私鑰（秘密，只貼進 wrangler secret put）：')
console.log(jwk.d)
