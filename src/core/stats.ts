// 今日統計：只記「今天」，跨日自動歸零。日期用使用者手機的當地時間。

export interface DailyStats {
  date: string
  completedPomodoros: number
  focusMinutes: number
}

export function localDateKey(time: number): string {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function emptyStats(today: string): DailyStats {
  return { date: today, completedPomodoros: 0, focusMinutes: 0 }
}

/** 讀出今天的數字；存的是昨天以前的就當作 0 */
export function statsForToday(stats: DailyStats, today: string): DailyStats {
  return stats.date === today ? stats : emptyStats(today)
}

export function recordFocus(stats: DailyStats, today: string, minutes: number): DailyStats {
  const current = statsForToday(stats, today)
  return {
    date: today,
    completedPomodoros: current.completedPomodoros + 1,
    focusMinutes: current.focusMinutes + Math.max(0, Math.round(minutes)),
  }
}

export function restoreStats(raw: unknown, today: string): DailyStats {
  if (typeof raw !== 'object' || raw === null) return emptyStats(today)
  const s = raw as Record<string, unknown>
  const isCount = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0
  if (typeof s.date !== 'string' || !isCount(s.completedPomodoros) || !isCount(s.focusMinutes)) {
    return emptyStats(today)
  }
  return statsForToday(
    { date: s.date, completedPomodoros: s.completedPomodoros, focusMinutes: s.focusMinutes },
    today,
  )
}
