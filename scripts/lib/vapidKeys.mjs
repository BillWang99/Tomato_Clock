// VAPID 金鑰的產生與設定檔改寫（不連網路），給 scripts/rotate-vapid.mjs 用，也方便測試。

/** 產生一組新的 VAPID 金鑰：公鑰是 65 bytes 的未壓縮點，私鑰是 JWK 的 d（皆 base64url） */
export async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKey: Buffer.from(raw).toString('base64url'), privateKey: jwk.d }
}

/** 改 push-worker/wrangler.jsonc 的 "VAPID_PUBLIC_KEY": "…" */
export function replaceWranglerPublicKey(text, publicKey) {
  const pattern = /("VAPID_PUBLIC_KEY"\s*:\s*")[^"]*(")/
  if (!pattern.test(text)) throw new Error('wrangler.jsonc 裡找不到 VAPID_PUBLIC_KEY')
  return text.replace(pattern, `$1${publicKey}$2`)
}

/** 改 src/core/pushConfig.ts 的 export const VAPID_PUBLIC_KEY: string = '…'（可能換行） */
export function replaceSitePublicKey(text, publicKey) {
  const pattern = /(export const VAPID_PUBLIC_KEY: string =\s*')[^']*(')/
  if (!pattern.test(text)) throw new Error('pushConfig.ts 裡找不到 VAPID_PUBLIC_KEY')
  return text.replace(pattern, `$1${publicKey}$2`)
}

/** 備份檔的內容：讓你匯入密碼管理器，看完就刪 */
export function backupFileContent({ publicKey, privateKey, createdAt }) {
  return [
    '像素蕃茄鐘 推播金鑰（VAPID）備份',
    `產生時間：${createdAt}`,
    '',
    '請把下面這兩行存進你的密碼管理器（例如 1Password、Bitwarden、iCloud 鑰匙圈），然後刪掉這個檔案。',
    '私鑰是秘密：不要傳給任何人、不要放進 Git、不要貼到聊天裡。',
    '',
    `私鑰（VAPID_PRIVATE_KEY）：${privateKey}`,
    `公鑰（VAPID_PUBLIC_KEY，可以公開）：${publicKey}`,
    '',
    '需要還原時：cd push-worker，執行 npx wrangler secret put VAPID_PRIVATE_KEY，貼上私鑰。',
    '',
  ].join('\n')
}
