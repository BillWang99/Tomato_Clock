// 今日統計：只記「今天」，跨日自動歸零。日期用使用者手機的當地時間。
// 專注時間存秒數（時長可以設到秒），畫面上再換算成分鐘。

export interface DailyStats {
  date: string
  completedPomodoros: number
  focusSeconds: number
}

export function localDateKey(time: number): string {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function emptyStats(today: string): DailyStats {
  return { date: today, completedPomodoros: 0, focusSeconds: 0 }
}

/** 讀出今天的數字；存的是昨天以前的就當作 0 */
export function statsForToday(stats: DailyStats, today: string): DailyStats {
  return stats.date === today ? stats : emptyStats(today)
}

export function recordFocus(stats: DailyStats, today: string, seconds: number): DailyStats {
  const current = statsForToday(stats, today)
  return {
    date: today,
    completedPomodoros: current.completedPomodoros + 1,
    focusSeconds: current.focusSeconds + Math.max(0, Math.round(seconds)),
  }
}

/** 畫面顯示用：無條件捨去到分鐘，50 分 30 秒顯示 50 分 */
export function focusMinutesOf(stats: DailyStats): number {
  return Math.floor(stats.focusSeconds / 60)
}

export function restoreStats(raw: unknown, today: string): DailyStats {
  if (typeof raw !== 'object' || raw === null) return emptyStats(today)
  const s = raw as Record<string, unknown>
  const isCount = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0
  // 第一版（v0.1.0）存的是 focusMinutes，換算成秒
  const focusSeconds = isCount(s.focusSeconds)
    ? s.focusSeconds
    : isCount(s.focusMinutes)
      ? s.focusMinutes * 60
      : null
  if (typeof s.date !== 'string' || !isCount(s.completedPomodoros) || focusSeconds === null) {
    return emptyStats(today)
  }
  return statsForToday(
    { date: s.date, completedPomodoros: s.completedPomodoros, focusSeconds },
    today,
  )
}
