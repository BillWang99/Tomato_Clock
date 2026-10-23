// 推播伺服器（push-worker/）的網址與 VAPID 公鑰。兩個都是公開資訊，不是秘密。
// 部署 Worker 後填入；任一個是空的，設定裡就不會出現「鎖螢幕也提醒」。

export const PUSH_API_URL: string = 'https://tomato-push.wang860218bill.workers.dev'
export const VAPID_PUBLIC_KEY: string =
  'BHCYyftXnITKY4fPhAKrzRjC_fCRfWne2trXjKC_gmCcu0xHXN1yvfWUvDoz1Gw5XjYgLfWzHvhQyUEci5I4nfE'

export function isPushConfigured(): boolean {
  return PUSH_API_URL !== '' && VAPID_PUBLIC_KEY !== ''
}
