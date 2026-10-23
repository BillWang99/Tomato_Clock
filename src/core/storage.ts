// localStorage 的唯一出入口。無痕模式、空間滿、資料被改壞都不能讓 App 當掉，所以全部 try/catch。

export const STORAGE_KEYS = Object.freeze({
  settings: 'tomato:settings',
  timer: 'tomato:timer',
  stats: 'tomato:stats',
  push: 'tomato:push',
})

export function readJson(key: string): unknown {
  try {
    const text = window.localStorage.getItem(key)
    return text === null ? null : JSON.parse(text)
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 存不進去（無痕模式、容量滿）就只在這次開啟期間有效，不打擾使用者
  }
}
