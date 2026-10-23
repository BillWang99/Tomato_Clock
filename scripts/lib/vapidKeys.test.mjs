import { describe, expect, it } from 'vitest'
import {
  backupFileContent,
  generateVapidKeys,
  replaceSitePublicKey,
  replaceWranglerPublicKey,
} from './vapidKeys.mjs'

describe('推播金鑰換新', () => {
  it('產生的公鑰是 65 bytes 的未壓縮點（開頭 0x04），私鑰是 32 bytes', async () => {
    const { publicKey, privateKey } = await generateVapidKeys()
    const pub = Buffer.from(publicKey, 'base64url')
    expect(pub.length).toBe(65)
    expect(pub[0]).toBe(4)
    expect(Buffer.from(privateKey, 'base64url').length).toBe(32)
  })

  it('改寫 wrangler.jsonc 的公鑰，其他內容不動', () => {
    const before = '  "PUSH_ENABLED": "true",\n    "VAPID_PUBLIC_KEY": "OLD"\n'
    expect(replaceWranglerPublicKey(before, 'NEW')).toBe(
      '  "PUSH_ENABLED": "true",\n    "VAPID_PUBLIC_KEY": "NEW"\n',
    )
  })

  it('改寫網站 pushConfig.ts 的公鑰（值在下一行也可以）', () => {
    const before = "export const VAPID_PUBLIC_KEY: string =\n  'OLD'\n"
    expect(replaceSitePublicKey(before, 'NEW')).toBe(
      "export const VAPID_PUBLIC_KEY: string =\n  'NEW'\n",
    )
  })

  it('找不到要改的位置：直接報錯，不會默默寫壞設定檔', () => {
    expect(() => replaceWranglerPublicKey('{}', 'NEW')).toThrow('找不到')
    expect(() => replaceSitePublicKey('', 'NEW')).toThrow('找不到')
  })

  it('備份檔寫明私鑰、公鑰、還原指令，並提醒存進密碼管理器後刪除', () => {
    const text = backupFileContent({ publicKey: 'PUB', privateKey: 'PRIV', createdAt: '現在' })
    expect(text).toContain('私鑰（VAPID_PRIVATE_KEY）：PRIV')
    expect(text).toContain('公鑰（VAPID_PUBLIC_KEY，可以公開）：PUB')
    expect(text).toContain('wrangler secret put VAPID_PRIVATE_KEY')
    expect(text).toContain('密碼管理器')
  })
})
