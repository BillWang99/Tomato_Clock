// 判斷使用者的裝置與開啟方式。推播與「安裝到裝置」都要用到。

// iPad 的 Safari 會假裝成 Mac，要用「有觸控螢幕的 Mac」來認
export function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent)
}

/** 從主畫面（或電腦上安裝的 App）打開，而不是在瀏覽器分頁裡 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
