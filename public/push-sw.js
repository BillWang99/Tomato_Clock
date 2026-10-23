// 推播用的 Service Worker 片段，由 vite-plugin-pwa 產生的 sw.js 用 importScripts 載入。
// 收到推播就顯示通知（iOS 規定每則推播都一定要顯示）；點通知就回到蕃茄鐘。

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || '⏰ 時間到！'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '回到像素蕃茄鐘看看吧',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      // 同一個 tag 會取代上一則，不會堆一大串
      tag: data.tag || 'tomato-timer',
      renotify: true,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.registration.scope))
      return open ? open.focus() : self.clients.openWindow(self.registration.scope)
    }),
  )
})
