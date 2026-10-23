// 產生一組「只給本機測試」的推播金鑰，印成 push-worker/.dev.vars 的格式。
// 跟正式環境的金鑰無關，可以放心顯示；正式金鑰請用 npm run vapid:rotate。
// 用法：npm run vapid:dev > push-worker/.dev.vars

import { generateVapidKeys } from './lib/vapidKeys.mjs'

const { publicKey, privateKey } = await generateVapidKeys()
console.log(`# 本機測試用的推播金鑰（不要用在正式環境）
VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}`)
